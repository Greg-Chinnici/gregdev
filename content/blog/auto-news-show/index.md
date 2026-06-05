---
title: "AutoNews: Turning Live Headlines into an AI News Broadcast"
date: 2025-05-26
summary: "A PantherHacks 2025 project that scrapes RSS feeds, clusters them into the day's top stories, writes a two-anchor script with a local LLM, voices it with Google TTS, and plays it back in a Unity newsroom."
draft: false
---

[AutoNews](https://github.com/Greg-Chinnici/AutoNews) was our submission for Chapman University's PantherHacks 2025 — built with [Spencer Au](https://github.com/SpencerAu). The pitch was simple: take the firehose of real-world news and turn it, automatically, into a watchable TV broadcast with two anchors trading lines back and forth.

The hard part is that "watchable broadcast" hides an entire pipeline. You have to decide _what_ the news is, gather it, write it into a script that sounds like people talking, give those people voices, and then actually stage the show. Here's how each piece works.

## Step 1: figuring out what the news even is

Everything starts with a list of RSS feeds — AP, the Guardian, NBC, CBS, ABC, CNBC, BBC. The ingest stage walks each feed, throws out the junk (live streams, "Watch:" video posts, daily-report filler), resolves the real article URL behind any redirects, and stores what's left in a local SQLite database.

The interesting move is what we store alongside each headline. Every title gets run through two things:

- **spaCy** for named-entity extraction — pulling out the people, orgs, and places a story is actually about.
- **A sentence-transformer** (`all-MiniLM-L6-v2`) to turn the title into an embedding — a vector that captures its _meaning_, not just its words.

```python
topics = extract_topics(title)
embedding = model.encode(title).tolist()

cursor.execute('''
    INSERT INTO articles (title, link, published_at, topics, embedding)
    VALUES (?, ?, ?, ?, ?)
''', (title, link, formatted_time, topics, json.dumps(embedding)))
```

That embedding is what makes the rest of the pipeline smart. We originally tried doing topic detection purely with spaCy's NLP, but raw entity matching is brittle — "Trump tariffs" and "the new import taxes" look like different stories to it. Embeddings understand they're the same one.

## Step 2: clustering the day's top stories

Once a few hundred headlines are embedded, we cluster them to find the stories everyone is covering. The trick is that the _biggest cluster_ is the biggest story of the day.

```python
oversample_clusters = int(num_topics * 2.5)
kmeans = KMeans(n_clusters=oversample_clusters, random_state=42)
kmeans.fit(embeddings)

# count how many articles landed in each cluster, keep the densest ones
sorted_clusters = sorted(cluster_density.items(), key=lambda x: x[1], reverse=True)
selected_cluster_ids = [cid for cid, count in sorted_clusters[:num_topics]]
```

We deliberately ask K-means for _more_ clusters than we need (2.5×), then keep only the densest few. Oversampling lets tight, well-defined stories separate themselves from the long tail of one-off articles. For each winning cluster we then pick the single headline closest to the cluster's center as its representative — the most "on-topic" framing of that story.

There's also a `GoogleFormsUpdater` that can push those top topics into a Google Form as radio options, which was our hook for letting viewers _vote_ on what the next segment should cover.

## Step 3: gathering the full story across sources

A headline isn't enough to write from, so for each chosen topic we go back out and scrape the actual article body. For every source, we find the article whose embedding is the closest cosine match to the topic, then pull its paragraphs with BeautifulSoup:

```python
topic_embedding = model.encode(selected_topic).reshape(1, -1)
similarity = cosine_similarity(topic_embedding, article_embedding)[0][0]

if similarity > best_similarity:
    best_similarity = similarity
    best_article = {"title": title, "link": link}
```

Anything below a 0.5 similarity threshold gets dropped — better to skip a source than to write from an article that's only tangentially related. The result is one aggregated text file per topic, combining how several outlets covered the same story.

## Step 4: writing the script with a local LLM

Now the fun part: turning that pile of article text into a conversation. We run [DeepSeek-R1 14B](https://ollama.com/) locally through Ollama and LangChain, prompting it to write a back-and-forth between two anchors, **Emily** and **David**.

The real engineering here isn't the prompt — it's _forcing the model to return clean, valid JSON_, which was easily our biggest headache. LLMs love to drift: inventing a `"speaker"` field, grouping lines, or trailing off mid-array. We pinned it down with a Pydantic schema that the output _must_ satisfy:

```python
class NewsScript(BaseModel):
    mainTitle: str
    characters: List[str]
    dialogue: List[DialogueLine]

    @model_validator(mode="after")
    def validate_dialogue_counts(self):
        # each anchor needs at least 15 lines or the script is rejected
        ...
```

Then LangChain's `OutputFixingParser` does something clever: when the model returns malformed JSON, it feeds the error _back into the LLM_ and asks it to repair its own output against the schema. Combined with strict prompt rules ("only use the fields `character` and `line`", "do NOT group multiple lines"), that's what finally gave us reliably parseable scripts of the right length.

## Step 5: giving the anchors voices

Each line of the finished script gets sent to **Google Cloud Text-to-Speech**, using the high-fidelity Chirp3-HD voices. Emily and David map to different voices so the broadcast actually sounds like two people:

```python
if character == "Emily":
    speaker = "lao_w"      # en-US-Chirp3-HD-Laomedeia
elif character == "David":
    speaker = "claude_m"   # en-US-Chirp3-HD-Enceladus
```

The output is one MP3 per line, numbered in speaking order (`1_Emily.mp3`, `2_David.mp3`, …), dropped into a per-segment folder alongside a `metadata.json` describing the whole script. That folder _is_ the contract between the Python backend and the Unity frontend.

## Step 6: staging the show in Unity

The frontend is a Unity app (codenamed **Feedr**) that turns those folders into an actual broadcast. A `SegmentLoader` reads each segment's `metadata.json`, preloads every audio clip, and builds a queue of `NewsLine` objects:

```csharp
NewsLine newsLine = new NewsLine(audioClip, text, character);
currentSegment.newsLines.Enqueue(newsLine);
```

Then the `ShowController` runs the broadcast as a coroutine: it spawns a character model for each anchor, dequeues lines one at a time, plays the matching audio clip, and fires a `NewLineContents` event so on-screen subtitles stay in sync. When a segment runs out of lines, it loads the next one and keeps the show rolling.

```csharp
talking.audioSource.clip = newsLine.voice_line;
NewLineContents.Invoke(newsLine.text_line);   // drives the subtitles
talking.audioSource.Play();

while (talking.audioSource.isPlaying && isPlaying)
    yield return null;                        // wait for the line to finish
```

Around that core loop there's a whole newsroom: a teleprompter, weather graphics, background music from a jukebox, ragdoll physics on the anchors, and a drag-and-drop pre-show for arranging segments. It leans into the goofy public-access-TV aesthetic on purpose.

## The full pipeline, end to end

Run it with a single script that chains the whole thing together:

```bash
bash scripts/create_script.sh
# ArticleIngest → ScrapeArticle → ScriptCreator → AudioCreator
```

…then hit play in Unity. Raw RSS feeds go in one end; a fully voiced, two-anchor news show comes out the other.

## What I took away from it

The thing I like about AutoNews is that every stage is a different _kind_ of problem. Ingestion is data plumbing. Clustering is unsupervised ML. Script generation is a fight to make an LLM behave like a strict API. Voicing is a cloud-API integration. Playback is real-time game-engine state. Getting them to hand off cleanly — especially settling on that `metadata.json` + numbered-audio folder as the boundary between Python and Unity — was most of the work.

The code's all up on [GitHub](https://github.com/Greg-Chinnici/AutoNews) if you want to poke around.
