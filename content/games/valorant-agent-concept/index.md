---
title: "Valorant Agent Concept: Gild"
date: 2026-09-06
summary: "An anti-utility agent who steals util instead of deleting it, and two passes at a kit that makes you pay to collect it."
tech: "Game Design, Technical Design, Prototyping"
role: "Game Designer"
draft: false
---

Veto was introduced earlier this year and has sat between 1 and 4% pick rate in pro play and ranked ever since. I don't think the problem is that utility control shouldn't be in the game. I think the problem is that his Interceptor removes value from the round and hands nothing back.

So I designed an agent who steals utility instead of denying it. Gild's Catcher moves a grenade from one team to the other, and makes you pay a positional cost to collect it. The counterplay is built into the item: it sits somewhere on the map, and going to get it tells the enemy where you are. The [full GDD is here](https://docs.google.com/document/d/1bYoyrUGmnaZamIjCa6nrM8IP3rVmv675OSmN5SIPg3E/edit?usp=sharing).

## Identity

A refined aristocratic hunter who treats the battlefield as a playground, built out of gold and tinted smoky glass, with a hunter's cloak for a silhouette that reads at distance. Fascinated by the elegance of nature, she built golden drones that mimic creatures so they can capture and preserve enemy technology as trophies. Beautiful, patient, obsessed with collecting.

The body is remote-piloted by her owner back in England, so her personality is really his, leaking through a machine that never takes the risk he doesn't want to take. That leaves room for internal dialogue — an operator arguing with the mind of the thing he's driving.

## The core loop

Catch, decide, risk the retrieval, repurpose. Everything in the kit hangs off that sequence.

She wants to be first contact on defense with enough left over to survive a late round, and a mid-round lurker on offense — somewhere the enemy has to throw utility through her to make progress.

## First pass: Sentinel

| Ability | Key | Cost |
| --- | --- | --- |
| Catcher | E | 3 charges, 150 each |
| Tinted Lens | Q | 2 charges, 200 each |
| Internal Research | C | 2 charges, 250 each |
| Drone Swarm | X | 6 ult points |

**Catcher is the whole agent.** A chandelier-like drone made of golden moths hangs in the air and creates a trigger area that captures up to three thrown enemy projectiles. Caught utility goes *into the Catcher*, not into your inventory — a moth carries each one above the drone inside a glass sphere, so both teams can see what's been taken.

From there you choose. Recall it, and the moths physically fly the utility back to you, which is visible and audible and gives your position away. Or release it where it sits, detonating it at the Catcher and giving up the chance to keep it. Free value only if you're willing to be somewhere known.

**Tinted Lens** temporarily cut the duration of incoming flashes and stuns. **Internal Research** burned a captured grenade as a power source so her next bullet dealt 1.5x damage for 15 seconds — bait a player into chasing the drone, then kill them from the ambush. **Drone Swarm** was a much larger interception zone placed from a tablet like a Brimstone smoke, no line of sight needed, with the same recall-or-release choice at scale.

### What broke

Drone Swarm was the dull part of the kit. It was Catcher again, bigger, and it did nothing for the big game hunter idea the rest of the design was reaching for.

Tinted Lens was too strong, and not in a numbers way. Flash resistance makes most entry kits useless against her, and the enemy has no way to learn she has it until after the fight is already lost.

Internal Research had the same flaw from the other direction. The target finds out about the 1.5x bullet by dying to it. Both abilities were information she held and nobody else could act on.

## Second pass: Controller

| Ability | Key | Cost |
| --- | --- | --- |
| Catcher | E | 1 free, 150 per extra (max 3) |
| Hunting Blind | Q | 200 base, 150 upgrade |
| Auric Trail | C | 2 charges, 350 each |
| Elephant Gun | X | 6 ult points |

Catcher survived unchanged except for its economy — one free charge, up to two more bought. It's her defining ability and the reason the concept exists.

**Hunting Blind is the honest version of flash resistance.** A breakable glass wall, not solid to players, that reduces the effect of flashes for anyone behind it — both teams, including her. She can temporarily make it hide things more than 5m past it. The protection is now a thing on the map that you can see, walk through, shoot out, or use yourself, instead of a buff she wears in secret.

**Auric Trail** replaces the ambush damage with information. While active, the next enemy she damages leaves a trail behind them that her whole team can see. It lags a few seconds behind the player and then fades, so it tracks a wounded target without simply revealing them.

**Elephant Gun** is a double-barrel blunderbuss. The left barrel is a slug that deals a one-time 70 damage and slows what it hits. The right barrel launches the target into the air. It's the trophy-hunting fantasy the ultimate slot was missing.

### Where it stands

The second kit fits the character better and is much less selfish — three of the four abilities now do something her team can see and use.

The part I'd still rework is capture itself: what can actually be caught, and what happens to it once it's inside the drone. Re-throwing the enemy's exact equipment may be the wrong answer. It might be better as a modifier applied to a piece of her own kit, so stolen utility comes back out as *hers*. It's an early, rough concept and I'm open to suggestions.
