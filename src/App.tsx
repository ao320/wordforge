import { useEffect, useMemo, useState } from "react";

type Example = { en: string; ja: string };
type WordEntry = { id: number; word: string; meaning: string; examples: Example[] };
type FilterMode = "all" | "unseen" | "seen" | "difficult";
type RangeGroup = { start: number; end: number; label: string };

declare const __WORD_FILES__: string[];
const STORAGE_KEY = "wordforge_state_v1";

function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function App() {
  const [words, setWords] = useState<WordEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [mode, setMode] = useState<"card" | "list">("card");
  const [direction, setDirection] = useState<"en-ja" | "ja-en">("en-ja");
  const [selectedRange, setSelectedRange] = useState<string | null>(null);
  const [openedListItems, setOpenedListItems] = useState<Set<number>>(new Set());
  const [animToken, setAnimToken] = useState(0);
  const [listPage, setListPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [knownIds, setKnownIds] = useState<Set<number>>(new Set());
  const [difficultIds, setDifficultIds] = useState<Set<number>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [jumpIdText, setJumpIdText] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const chunks = await Promise.all(
          __WORD_FILES__.map(async (file) => {
            const res = await fetch(`./data/${file}`);
            if (!res.ok) throw new Error(`Failed to load ${file}`);
            return (await res.json()) as WordEntry[];
          }),
        );
        setWords(chunks.flat().sort((a, b) => a.id - b.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as {
          index?: number;
          mode?: "card" | "list";
          direction?: "en-ja" | "ja-en";
          selectedRange?: string | null;
          listPage?: number;
          search?: string;
          filterMode?: FilterMode;
          knownIds?: number[];
          difficultIds?: number[];
        };
        setIndex(s.index ?? 0);
        setMode(s.mode ?? "card");
        setDirection(s.direction ?? "en-ja");
        setSelectedRange(s.selectedRange ?? null);
        setListPage(s.listPage ?? 1);
        setSearch(s.search ?? "");
        setFilterMode(s.filterMode ?? "all");
        setKnownIds(new Set(s.knownIds ?? []));
        setDifficultIds(new Set(s.difficultIds ?? []));
      }
    } catch {
      // ignore
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        index,
        mode,
        direction,
        selectedRange,
        listPage,
        search,
        filterMode,
        knownIds: [...knownIds],
        difficultIds: [...difficultIds],
      }),
    );
  }, [hydrated, index, mode, direction, selectedRange, listPage, search, filterMode, knownIds, difficultIds]);

  const speakEnglish = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    const voices = window.speechSynthesis.getVoices();
    u.voice = voices.find((v) => v.lang.toLowerCase().startsWith("en-us")) ?? voices.find((v) => v.lang.toLowerCase().startsWith("en")) ?? null;
    window.speechSynthesis.speak(u);
  };

  const ranges = useMemo<RangeGroup[]>(() => {
    if (words.length === 0) return [];
    const maxId = Math.max(...words.map((w) => w.id));
    const result: RangeGroup[] = [];
    for (let start = 1; start <= maxId; start += 100) {
      const end = Math.min(start + 99, maxId);
      if (words.some((w) => w.id >= start && w.id <= end)) {
        result.push({ start, end, label: `${start}-${end}` });
      }
    }
    return result;
  }, [words]);

  const currentRange = ranges.find((r) => r.label === selectedRange) ?? null;

  const filteredWords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return words.filter((w) => {
      const byFilter =
        filterMode === "all" ||
        (filterMode === "seen" && knownIds.has(w.id)) ||
        (filterMode === "unseen" && !knownIds.has(w.id)) ||
        (filterMode === "difficult" && difficultIds.has(w.id));
      if (!byFilter) return false;
      if (!q) return true;
      return `${w.word} ${w.meaning} ${w.examples.map((e) => `${e.en} ${e.ja}`).join(" ")}`.toLowerCase().includes(q);
    });
  }, [words, search, filterMode, knownIds, difficultIds]);

  const cardWords = useMemo(() => {
    if (!currentRange) return [];
    return filteredWords.filter((w) => w.id >= currentRange.start && w.id <= currentRange.end);
  }, [filteredWords, currentRange]);

  useEffect(() => {
    if (!hydrated || loading) return;
    const target = mode === "card" ? cardWords : filteredWords;
    if (target.length === 0) return;
    setIndex((p) => Math.min(p, target.length - 1));
  }, [hydrated, loading, mode, filteredWords, cardWords]);

  const current = mode === "card" ? cardWords[index] : filteredWords[index];
  const activeCardLength = cardWords.length;
  const progress = activeCardLength === 0 ? 0 : ((index + 1) / activeCardLength) * 100;

  const nextWord = () => {
    if (!activeCardLength) return;
    setShowAnswer(false);
    setIndex((p) => (p + 1) % activeCardLength);
    setAnimToken((t) => t + 1);
  };
  const prevWord = () => {
    if (!activeCardLength) return;
    setShowAnswer(false);
    setIndex((p) => (p - 1 + activeCardLength) % activeCardLength);
    setAnimToken((t) => t + 1);
  };
  const jumpBy = (delta: number) => {
    if (!activeCardLength) return;
    setShowAnswer(false);
    setIndex((p) => Math.max(0, Math.min(activeCardLength - 1, p + delta)));
    setAnimToken((t) => t + 1);
  };
  const jumpToId = () => {
    const id = Number(jumpIdText);
    if (!Number.isFinite(id)) return;
    const idx = cardWords.findIndex((w) => w.id === id);
    if (idx >= 0) {
      setIndex(idx);
      setShowAnswer(false);
      setAnimToken((t) => t + 1);
    }
  };

  const shuffle = () => {
    if (!words.length) return;
    setWords((prev) => [...prev].sort(() => Math.random() - 0.5));
    setIndex(0);
    setShowAnswer(false);
    setAnimToken((t) => t + 1);
  };

  const toggleListItem = (id: number) =>
    setOpenedListItems((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const switchDirection = (nextDirection: "en-ja" | "ja-en") => {
    setDirection(nextDirection);
    setShowAnswer(false);
    setOpenedListItems(new Set());
    setAnimToken((t) => t + 1);
  };
  const markKnown = (id: number) => setKnownIds((prev) => new Set(prev).add(id));
  const toggleDifficult = (id: number) =>
    setDifficultIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const switchToList = () => {
    setMode("list");
    setOpenedListItems(new Set());
    if (currentRange) {
      const startIndex = filteredWords.findIndex((w) => w.id >= currentRange.start && w.id <= currentRange.end);
      if (startIndex >= 0) {
        setListPage(Math.floor(startIndex / 100) + 1);
        return;
      }
    }
    setListPage(1);
  };

  const ITEMS_PER_PAGE = 100;
  const totalPages = Math.max(1, Math.ceil(filteredWords.length / ITEMS_PER_PAGE));
  const safePage = Math.min(listPage, totalPages);
  const pagedWords = filteredWords.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (mode !== "card" || !current || !selectedRange) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || t?.isContentEditable) return;
      const k = e.key.toLowerCase();
      if (e.key === "ArrowLeft") return e.preventDefault(), prevWord();
      if (e.key === "ArrowRight") return e.preventDefault(), nextWord();
      if (e.code === "Space") return e.preventDefault(), setShowAnswer((s) => !s);
      if (k === "a") return e.preventDefault(), speakEnglish(current.word);
      if (k === "s") return e.preventDefault(), shuffle();
      if (k === "d") return e.preventDefault(), toggleDifficult(current.id);
      if (k === "k") return e.preventDefault(), markKnown(current.id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, current, selectedRange, activeCardLength]);

  if (loading) return <main className="container">読み込み中...</main>;
  if (error) return <main className="container">読み込みに失敗しました: {error}</main>;

  return (
    <main className="container">
      <header className={`top ${mode === "list" ? "topSticky" : ""}`}>
        <h1>WordForge</h1>
        <section className="switchPanel">
          <div className="switchGroup">
            <p className="switchLabel">表示モード</p>
            <div className="modeSwitch">
              <button onClick={() => setMode("card")} className={mode === "card" ? "active" : ""}>
                カード
              </button>
              <button onClick={switchToList} className={mode === "list" ? "active" : ""}>
                一覧
              </button>
            </div>
          </div>
          <div className="switchGroup">
            <p className="switchLabel">学習方向</p>
            <div className="modeSwitch">
              <button onClick={() => switchDirection("en-ja")} className={direction === "en-ja" ? "active" : ""}>
                英日
              </button>
              <button onClick={() => switchDirection("ja-en")} className={direction === "ja-en" ? "active" : ""}>
                日英
              </button>
            </div>
          </div>
        </section>

        <section className="toolRow">
          <input className="searchInput" value={search} onChange={(e) => (setSearch(e.target.value), setListPage(1), setIndex(0))} placeholder="検索（単語・意味・例文）" />
          <div className="modeSwitch filterSwitch">
            <button className={filterMode === "all" ? "active" : ""} onClick={() => setFilterMode("all")}>
              全部
            </button>
            <button className={filterMode === "unseen" ? "active" : ""} onClick={() => setFilterMode("unseen")}>
              未確認
            </button>
            <button className={filterMode === "seen" ? "active" : ""} onClick={() => setFilterMode("seen")}>
              確認済み
            </button>
            <button className={filterMode === "difficult" ? "active" : ""} onClick={() => setFilterMode("difficult")}>
              苦手
            </button>
          </div>
        </section>
      </header>

      <section className={`contentArea ${mode === "list" ? "listMode" : ""}`}>
        {mode === "card" ? (
          selectedRange === null ? (
            <section className="rangePicker">
              <p className="switchLabel">学習する範囲を選択</p>
              <div className="rangeGrid">
                {ranges.map((r) => (
                  <button
                    key={r.label}
                    className="rangeBtn"
                    onClick={() => {
                      setSelectedRange(r.label);
                      setIndex(0);
                      setShowAnswer(false);
                      setAnimToken((t) => t + 1);
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <>
              {current ? (
                <div className="contentFade" key={`card-main-${direction}-${selectedRange}-${animToken}`}>
                  <section className="progress">
                    <div className="bar" style={{ width: `${progress}%` }} />
                  </section>

                  <article className={`card ${showAnswer ? "open" : ""}`} onClick={() => setShowAnswer((s) => !s)}>
                    <p className="id">#{current.id}</p>
                    <div className="cardPrompt">
                      <h2 className="word">{direction === "en-ja" ? current.word : current.meaning}</h2>
                      <button className="audioBtn" aria-label="単語を読み上げ" onClick={(e) => (e.stopPropagation(), speakEnglish(current.word))}>
                        <Icon d="M3 10v4h4l5 4V6L7 10H3zm13.5-2.5a6 6 0 0 1 0 9m2.8-11.8a10 10 0 0 1 0 14.6" />
                      </button>
                    </div>

                    <div className={`answerWrap ${showAnswer ? "open" : ""}`}>
                      <div className="answer">
                        <p className="meaning">{direction === "en-ja" ? current.meaning : current.word}</p>
                        {current.examples.map((ex, i) => (
                          <div className="example" key={`${current.id}-${i}`}>
                            <p>
                              {ex.en}
                              <button className="audioInline" aria-label="例文を読み上げ" onClick={(e) => (e.stopPropagation(), speakEnglish(ex.en))}>
                                <Icon d="M3 10v4h4l5 4V6L7 10H3zm13.5-2.5a6 6 0 0 1 0 9" size={16} />
                              </button>
                            </p>
                            <p>{ex.ja}</p>
                          </div>
                        ))}
                        <div className="markRow">
                          <button className="stateBtn" aria-label="確認済み" onClick={(e) => (e.stopPropagation(), markKnown(current.id))}>
                            <Icon d="M5 13l4 4L19 7" />
                          </button>
                          <button className={`stateBtn ${difficultIds.has(current.id) ? "activeState" : ""}`} aria-label="苦手トグル" onClick={(e) => (e.stopPropagation(), toggleDifficult(current.id))}>
                            <Icon d="M12 17.3l-5.2 3 1.4-5.9L3.5 10l6.1-.5L12 4l2.4 5.5 6.1.5-4.7 4.4 1.4 5.9z" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                </div>
              ) : (
                <section className="emptyState">この範囲で条件に合う単語がありません。検索やフィルタを変更してください。</section>
              )}

              <section className="jumpRow">
                <button className="miniBtn" onClick={() => jumpBy(-50)}>
                  -50
                </button>
                <button className="miniBtn" onClick={() => jumpBy(-10)}>
                  -10
                </button>
                <input className="jumpInput" value={jumpIdText} onChange={(e) => setJumpIdText(e.target.value)} placeholder="ID" />
                <button className="miniBtn" onClick={jumpToId}>
                  Go
                </button>
                <button className="miniBtn" onClick={() => jumpBy(10)}>
                  +10
                </button>
                <button className="miniBtn" onClick={() => jumpBy(50)}>
                  +50
                </button>
                <button className="miniBtn" onClick={() => (setSelectedRange(null), setIndex(0), setShowAnswer(false))}>
                  範囲変更
                </button>
              </section>

              <section className="actions">
                <button onClick={prevWord} className="navBtn" aria-label="前へ">
                  <Icon d="M15 18l-6-6 6-6" />
                </button>
                <button onClick={nextWord} className="navBtn" aria-label="次へ">
                  <Icon d="M9 6l6 6-6 6" />
                </button>
                <button onClick={shuffle} className="iconBtn" aria-label="シャッフル">
                  <Icon d="M17 3h4v4M3 7h3l5 5-5 5H3m8-10l2-2c1.1-1.1 2.9-1.1 4 0l1 1m-7 12l2 2c1.1 1.1 2.9 1.1 4 0l1-1" />
                </button>
              </section>
            </>
          )
        ) : (
          <section className="listShell">
            <section className="listPager">
              <button className="navBtn jumpBtn" onClick={() => (setListPage((p) => Math.max(1, p - 5)), setOpenedListItems(new Set()))} disabled={safePage === 1}>
                <Icon d="M18 6l-6 6 6 6M12 6l-6 6 6 6" />
              </button>
              <button className="navBtn" onClick={() => (setListPage((p) => Math.max(1, p - 1)), setOpenedListItems(new Set()))} disabled={safePage === 1}>
                <Icon d="M15 18l-6-6 6-6" />
              </button>
              <p>
                {safePage} / {totalPages}
              </p>
              <button className="navBtn" onClick={() => (setListPage((p) => Math.min(totalPages, p + 1)), setOpenedListItems(new Set()))} disabled={safePage === totalPages}>
                <Icon d="M9 6l6 6-6 6" />
              </button>
              <button className="navBtn jumpBtn" onClick={() => (setListPage((p) => Math.min(totalPages, p + 5)), setOpenedListItems(new Set()))} disabled={safePage === totalPages}>
                <Icon d="M6 6l6 6-6 6m6-12l6 6-6 6" />
              </button>
            </section>

            <section className="list contentFade" key={`list-main-${direction}-${safePage}-${animToken}`}>
              {pagedWords.map((w) => (
                <article className={`listItem ${openedListItems.has(w.id) ? "open" : ""}`} key={w.id} onClick={() => toggleListItem(w.id)}>
                  <p className="id">#{w.id}</p>
                  <div className="listLeft">
                    <h3 className="listWord">{direction === "en-ja" ? w.word : w.meaning}</h3>
                    <button className="audioBtn" aria-label="単語を読み上げ" onClick={(e) => (e.stopPropagation(), speakEnglish(w.word))}>
                      <Icon d="M3 10v4h4l5 4V6L7 10H3zm13.5-2.5a6 6 0 0 1 0 9" />
                    </button>
                  </div>
                  <div className="listRight">
                    {openedListItems.has(w.id) ? (
                      <div className="listAnswerWrap open">
                        <p className="meaning">{direction === "en-ja" ? w.meaning : w.word}</p>
                        {w.examples.map((ex, i) => (
                          <div className="example" key={`${w.id}-${i}`}>
                            <p>
                              {ex.en}
                              <button className="audioInline" aria-label="例文を読み上げ" onClick={(e) => (e.stopPropagation(), speakEnglish(ex.en))}>
                                <Icon d="M3 10v4h4l5 4V6L7 10H3zm13.5-2.5a6 6 0 0 1 0 9" size={16} />
                              </button>
                            </p>
                            <p>{ex.ja}</p>
                          </div>
                        ))}
                        <div className="markRow">
                          <button className="stateBtn" aria-label="確認済み" onClick={(e) => (e.stopPropagation(), markKnown(w.id))}>
                            <Icon d="M5 13l4 4L19 7" />
                          </button>
                          <button className={`stateBtn ${difficultIds.has(w.id) ? "activeState" : ""}`} aria-label="苦手トグル" onClick={(e) => (e.stopPropagation(), toggleDifficult(w.id))}>
                            <Icon d="M12 17.3l-5.2 3 1.4-5.9L3.5 10l6.1-.5L12 4l2.4 5.5 6.1.5-4.7 4.4 1.4 5.9z" />
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </section>
          </section>
        )}
      </section>
    </main>
  );
}
