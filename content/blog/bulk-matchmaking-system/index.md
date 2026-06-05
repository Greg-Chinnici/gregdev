---
title: "Building a Bulk Matchmaking System in Go"
date: 2026-04-04
summary: "A Glicko-2 matchmaking server in Go — skill-sorted queues, pluggable team-balancing strategies, and a worker pool that can chew through thousands of players at once."
draft: false
---

Every competitive game needs an answer to the same question: _who plays against whom?_ Put two mismatched players in a lobby and somebody has a miserable time. So I built [go-match-maker](https://github.com/Greg-Chinnici/go-match-maker) — a matchmaking server in Go that sorts players by skill, packs them into fair lobbies, splits those lobbies into balanced teams, and does it all fast enough to handle a flood of players at once.

This post walks through how it works.

## Glicko-2 instead of ELO

Ratings are the foundation, so I started there. Most people reach for ELO, but ELO has a blind spot: it treats a brand-new player and a 500-game veteran with the same number as equally _certain_. Glicko-2 fixes that by tracking three numbers per player instead of one:

- **Rating** — the skill estimate (everyone starts at 1500).
- **RD** (rating deviation) — how _confident_ we are in that estimate. New players start at a wide 350 and narrow as they play.
- **Volatility** — how erratic their recent results have been.

```go
const (
    DefaultRating     = 1500.0
    DefaultRD         = 350.0
    DefaultVolatility = 0.06
    DefaultTau        = 0.5

    glickoScale = 173.7178
)
```

The payoff is that an uncertain new player's rating moves quickly, while an established player's barely budges from a single upset. I implemented the full algorithm from scratch — the `g`/`E` factors, the variance and delta estimates, and the trickiest part, solving for the new volatility with the Illinois variant of regula-falsi:

```go
// illinois algorithm to compute the new volatility.
func (p *Player) newVolatility(v, delta, tau float64) float64 {
    const epsilon = 1e-6
    // ... iterate until |b - a| converges
}
```

One subtle but important detail: when a match resolves, every player is updated against their opponents' **pre-match** snapshots, not their freshly-updated ratings. Otherwise the order you process players in would change the outcome.

```go
func (p *Player) UpdateWithTau(opponents []*Player, scores []float64, tau float64) {
    results := make([]Result, len(opponents))
    for i, opp := range opponents {
        results[i] = Result{
            Opponent: opp.snapshot(), // use pre-period ratings
            Score:    scores[i],
        }
    }
    p.update(results, tau)
}
```

There's also an `UpdateTeamMatch` helper that treats a team-vs-team result as each player on the winning side beating each player on the losing side — a simple way to fan a single match outcome out to everyone involved.

## The queue is a B-tree

When players queue up, they land in a B-tree keyed by rating (ties broken by UUID). Why a B-tree and not just a slice I sort? Because the queue is constantly churning — players join, get matched, and leave — and a B-tree keeps everything sorted with cheap inserts and deletes while letting me walk players in skill order.

```go
func (p PlayerItem) Less(than btree.Item) bool {
    a := p.Player
    b := than.(PlayerItem).Player

    if a.Rating != b.Rating {
        return a.Rating < b.Rating
    }
    return a.ID < b.ID
}
```

Matchmaking itself is a **sliding window** over that sorted tree. Walk players in ascending rating order, accumulate them into a window the size of a lobby, and check whether the window is tight enough — i.e. the gap between the lowest- and highest-rated player is under a configurable threshold:

```go
func isValidMatch(lobby []*glicko.Player, maxRatingDiff float64) bool {
    return lobby[len(lobby)-1].Rating-lobby[0].Rating < maxRatingDiff
}
```

If the window is valid, those players get pulled into a match and removed from the tree. If it isn't, the window slides forward by one and tries again. Because the tree is sorted, the first and last entries of any window are also its rating extremes, so the validity check is just two array lookups. The whole thing runs under a mutex so concurrent `/queue` requests and the match loop don't step on each other.

## Pluggable team strategies

Once you have a lobby of the right players, you still have to _split_ them into teams — and different game modes want different things. I modeled this as a strategy interface:

```go
type MatchStrategy interface {
    BuildMatch(players []*glicko.Player, teamCount int) ([]Team, error)
}
```

That made it easy to ship several balancing approaches, each a tiny struct:

- **FFA** — every player is their own team. Battle-royale-style free-for-all.
- **RandomTeam** — shuffle and deal players out round-robin. Fast, chaotic, fine for casual.
- **SnakeDraft** — the classic serpentine draft. Walking the (skill-sorted) lobby and snaking the pick order across teams keeps the strongest and weakest players spread evenly.
- **OptimalTeam** — a greedy balancer that always assigns the next player to whichever team currently has the lowest total rating, minimizing the spread of team averages.

A small factory wires game-mode flags to a config:

```go
func ConfigFactory(gameType string, lobbySize, teamCount int) (MatchConfig, error) {
    switch gameType {
    case "FFA":
        return NewFFAConfig(lobbySize), nil
    case "TDM":
        return NewCasualTeamDeathmatch(lobbySize), nil
    case "BR":
        return NewBattleRoyale(lobbySize, teamCount), nil
    default:
        return NewFFAConfig(1), fmt.Errorf("invalid match config: %s", gameType)
    }
}
```

So launching a 24-player, 6-team battle royale is just:

```
go run main.go -gamemode BR -lobby 24 -teamCount 6
```

## Surviving a flood of players

The "bulk" in the title is the part I cared most about. A real matchmaker isn't handling players one at a time — it's absorbing thousands at peak. The architecture has three moving parts that let it keep up:

1. **A match loop** ticks once a second, drains every valid lobby out of the queue, and hands each one off to a buffered jobs channel (room for 1000 pending matches).
2. **A worker pool** of goroutines pulls matches off that channel and resolves them in parallel. The pool size caps how many matches run concurrently, so a surge fills the buffer instead of spawning unbounded goroutines.
3. **A mock game resolver** stands in for real game servers — it sleeps a random beat to simulate match length, picks a winner, and POSTs the result back to `/report`, which triggers the Glicko-2 update and persists everyone to Postgres.

```go
jobs := make(chan *matchmaking.ActiveMatch, matchesWaitingSize)
server.StartWorkerPool(activeMatchesAtOnce, jobs)
```

That `mockGameResolver` is deliberately a seam. In production you'd hand the match off to actual game servers and let _them_ report the outcome; swapping the mock for a real dispatcher doesn't touch the matchmaking core at all.

State lives in Postgres (via the `pgx` driver) — each player row is just their UUID, rating, RD, and volatility, the four numbers Glicko-2 needs to pick up where it left off. The whole thing runs in Docker with a `.env` for credentials.

## Testing it at scale

To actually stress the system I added a `seed` command that generates 1000 normally-distributed players, plus a Python harness (`BulkTests/`) that fires players at the `/queue` endpoint as fast as it can, then reads back `/active-matches` and reports random winners. Watching the server log fill with balanced lobbies — and watching ratings converge as thousands of mock games resolve — is a surprisingly satisfying way to confirm the whole pipeline holds together under load.

The HTTP surface is small and easy to poke at: `/queue` to enqueue, `/status` for queue size and active match counts, `/ratings` to dump the registry, `/active-matches` to inspect lobbies, and `/report` to submit a result.

## Where it's headed

A few things I want to build on this foundation:

- **Richer match evaluation** — folding average ping and player roles into the "is this a good match?" decision, not just rating proximity.
- **Smarter team balancing** — tightening up the greedy/optimal strategies and comparing how even the resulting team averages actually come out.

The core turned out to be a fun mix of numerical methods (the Glicko-2 volatility solver), data structures (the B-tree queue), and concurrency (the worker pool). If you want to dig into the code, it's all on [GitHub](https://github.com/Greg-Chinnici/go-match-maker).
