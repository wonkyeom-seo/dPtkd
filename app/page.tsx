"use client";

import {
  BarChart3,
  Check,
  ChevronRight,
  FileText,
  Info,
  LockKeyhole,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  UploadCloud,
  Users,
} from "lucide-react";
import type { CSSProperties, ChangeEvent, DragEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { calculateVoteResults } from "./vote-math";

type Candidate = {
  id: string;
  name: string;
  letter: string;
  color: string;
  soft: string;
  ink: string;
};

type Person = {
  id: string;
  name: string;
  picks: string[];
};

const CANDIDATE_PALETTE = [
  { color: "#4f46e5", soft: "#eeefff", ink: "#3730a3" },
  { color: "#0f8f80", soft: "#e4f7f3", ink: "#09645b" },
  { color: "#d97706", soft: "#fff5dd", ink: "#9a5300" },
  { color: "#db4766", soft: "#ffedf1", ink: "#a92749" },
  { color: "#0284c7", soft: "#e8f6fd", ink: "#075985" },
  { color: "#7c3aed", soft: "#f2ebff", ink: "#5b21b6" },
  { color: "#059669", soft: "#e6f8f0", ink: "#047857" },
  { color: "#ea580c", soft: "#fff0e7", ink: "#b73d07" },
  { color: "#c026d3", soft: "#faeafb", ink: "#8c1b9c" },
  { color: "#2563eb", soft: "#eaf1ff", ink: "#1d4ed8" },
  { color: "#4d7c0f", soft: "#f0f8df", ink: "#3f6212" },
  { color: "#475569", soft: "#eef1f5", ink: "#334155" },
] as const;

const MIN_CANDIDATES = 2;
const MAX_CANDIDATES = CANDIDATE_PALETTE.length;
const MAX_PEOPLE = 1000;
const MAX_FILE_SIZE = 2 * 1024 * 1024;

function candidateLetter(index: number) {
  return String.fromCharCode(65 + index);
}

function makeCandidate(index: number, id = `team-${index + 1}`): Candidate {
  return {
    id,
    name: `${index + 1}팀`,
    letter: candidateLetter(index),
    ...CANDIDATE_PALETTE[index % CANDIDATE_PALETTE.length],
  };
}

const INITIAL_CANDIDATES = Array.from({ length: 4 }, (_, index) =>
  makeCandidate(index),
);

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseNames(value: string) {
  return value
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function decodeNameFile(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(buffer);
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(buffer);
  }
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(buffer);
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("euc-kr").decode(buffer);
  }
}

function formatNumber(value: number) {
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function candidateStyle(candidate: Candidate) {
  return {
    "--candidate": candidate.color,
    "--candidate-soft": candidate.soft,
    "--candidate-ink": candidate.ink,
  } as CSSProperties;
}

export default function Home() {
  const [candidates, setCandidates] = useState<Candidate[]>(INITIAL_CANDIDATES);
  const [namesText, setNamesText] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [inputMode, setInputMode] = useState<"text" | "file">("text");
  const [searchTerm, setSearchTerm] = useState("");
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLElement>(null);

  const completedPeople = useMemo(
    () => people.filter((person) => person.picks.length > 0),
    [people],
  );
  const incompleteCount = people.length - completedPeople.length;

  const results = useMemo(
    () => calculateVoteResults(candidates, people),
    [candidates, people],
  );

  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    people.forEach((person) => {
      counts.set(person.name, (counts.get(person.name) ?? 0) + 1);
    });
    return new Set(
      [...counts.entries()]
        .filter(([, count]) => count > 1)
        .map(([name]) => name),
    );
  }, [people]);

  const invalidCandidateIds = useMemo(() => {
    const normalized = candidates.map((candidate) =>
      candidate.name.trim().toLocaleLowerCase("ko"),
    );
    return new Set(
      candidates
        .filter((_, index) => {
          const name = normalized[index];
          return (
            !name ||
            normalized.some(
              (candidateName, candidateIndex) =>
                candidateIndex !== index && candidateName === name,
            )
          );
        })
        .map((candidate) => candidate.id),
    );
  }, [candidates]);
  const candidateNameIssue = invalidCandidateIds.size > 0;

  const visiblePeople = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase("ko");
    return people.filter((person) => {
      const matchesSearch =
        !normalizedSearch ||
        person.name.toLocaleLowerCase("ko").includes(normalizedSearch);
      const matchesStatus = !onlyIncomplete || person.picks.length === 0;
      return matchesSearch && matchesStatus;
    });
  }, [onlyIncomplete, people, searchTerm]);

  function syncPeopleFromText(text: string) {
    const names = parseNames(text);
    if (names.length > MAX_PEOPLE) {
      setMessage(
        `명단은 최대 ${MAX_PEOPLE.toLocaleString("ko-KR")}명까지 사용할 수 있어요. 인원을 나누어 다시 입력해 주세요.`,
      );
      return;
    }
    const usedIds = new Set<string>();

    const nextPeople = names.map((name, index) => {
      const samePosition = people[index];
      if (
        samePosition &&
        samePosition.name === name &&
        !usedIds.has(samePosition.id)
      ) {
        usedIds.add(samePosition.id);
        return samePosition;
      }

      const existing = people.find(
        (person) => person.name === name && !usedIds.has(person.id),
      );
      if (existing) {
        usedIds.add(existing.id);
        return existing;
      }

      const person = { id: createId(), name, picks: [] };
      usedIds.add(person.id);
      return person;
    });

    setPeople(nextPeople);
    setSearchTerm("");
    setOnlyIncomplete(false);

    if (names.length === 0) {
      setMessage("이름을 찾지 못했어요. 한 줄에 이름 하나씩 입력해 주세요.");
    } else {
      const rawLineCount = text.split(/\r?\n/).length;
      const ignoredCount = Math.max(0, rawLineCount - names.length);
      setMessage(
        `${names.length}명을 명단에 반영했어요.${
          ignoredCount ? ` 빈 줄 ${ignoredCount}개는 제외했어요.` : ""
        }`,
      );
    }
  }

  function applyNames() {
    syncPeopleFromText(namesText);
  }

  async function readTextFile(file?: File) {
    if (!file) return;
    if (!file.name.toLocaleLowerCase().endsWith(".txt")) {
      setMessage("TXT 파일만 불러올 수 있어요.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setMessage("파일이 너무 커요. 2MB 이하의 TXT 파일을 사용해 주세요.");
      return;
    }
    if (
      people.length > 0 &&
      !window.confirm("현재 명단을 새 TXT 파일의 명단으로 바꿀까요?")
    ) {
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const decoded = decodeNameFile(buffer);
      setNamesText(decoded);
      syncPeopleFromText(decoded);
      setInputMode("text");
    } catch {
      setMessage("파일을 읽지 못했어요. UTF-8 형식의 TXT 파일인지 확인해 주세요.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    void readTextFile(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void readTextFile(event.dataTransfer.files?.[0]);
  }

  function updateCandidateName(candidateId: string, name: string) {
    setCandidates((current) =>
      current.map((candidate) =>
        candidate.id === candidateId ? { ...candidate, name } : candidate,
      ),
    );
  }

  function addCandidate() {
    if (candidates.length >= MAX_CANDIDATES) {
      setMessage(`후보는 최대 ${MAX_CANDIDATES}개까지 만들 수 있어요.`);
      return;
    }

    setCandidates((current) => {
      const usedColors = new Set(current.map((candidate) => candidate.color));
      const usedNames = new Set(current.map((candidate) => candidate.name.trim()));
      const paletteIndex = CANDIDATE_PALETTE.findIndex(
        (palette) => !usedColors.has(palette.color),
      );
      const colorIndex = paletteIndex === -1 ? current.length : paletteIndex;
      const firstUnusedNumber = Array.from(
        { length: MAX_CANDIDATES },
        (_, index) => index + 1,
      ).find((number) => !usedNames.has(`${number}팀`));
      const nextCandidate = {
        id: createId(),
        name: `${firstUnusedNumber ?? current.length + 1}팀`,
        letter: candidateLetter(current.length),
        ...CANDIDATE_PALETTE[colorIndex],
      };
      return [...current, nextCandidate];
    });
    setMessage("새 후보를 추가했어요. 이름을 자유롭게 바꿔 주세요.");
  }

  function removeCandidate(candidateId: string) {
    if (candidates.length <= MIN_CANDIDATES) {
      setMessage(`후보는 최소 ${MIN_CANDIDATES}개가 필요해요.`);
      return;
    }

    const candidate = candidates.find((item) => item.id === candidateId);
    const affectedCount = people.filter((person) =>
      person.picks.includes(candidateId),
    ).length;
    if (
      affectedCount > 0 &&
      !window.confirm(
        `${candidate?.name || "이 후보"}를 삭제할까요? ${affectedCount}명의 연결된 선택도 함께 해제됩니다.`,
      )
    ) {
      return;
    }

    setCandidates((current) =>
      current
        .filter((item) => item.id !== candidateId)
        .map((item, index) => ({ ...item, letter: candidateLetter(index) })),
    );
    setPeople((current) =>
      current.map((person) => ({
        ...person,
        picks: person.picks.filter((pick) => pick !== candidateId),
      })),
    );
    setMessage(`${candidate?.name || "후보"}를 삭제했어요.`);
  }

  function togglePick(personId: string, candidateId: string) {
    setPeople((current) =>
      current.map((person) => {
        if (person.id !== personId) return person;
        const picks = person.picks.includes(candidateId)
          ? person.picks.filter((pick) => pick !== candidateId)
          : [...person.picks, candidateId];
        return { ...person, picks };
      }),
    );
    setMessage("예상 결과를 새로 계산했어요.");
  }

  function removePerson(personId: string) {
    const nextPeople = people.filter((person) => person.id !== personId);
    setPeople(nextPeople);
    setNamesText(nextPeople.map((person) => person.name).join("\n"));
    setMessage("명단에서 한 명을 삭제했어요.");
  }

  function resetAll() {
    if (
      !window.confirm(
        "모든 입력을 지울까요? 후보 설정, 명단과 선택 내역이 모두 삭제됩니다.",
      )
    ) {
      return;
    }
    setCandidates(INITIAL_CANDIDATES);
    setNamesText("");
    setPeople([]);
    setSearchTerm("");
    setOnlyIncomplete(false);
    setMessage("모든 입력을 초기화했어요.");
  }

  function getDuplicateIndex(person: Person) {
    if (!duplicateNames.has(person.name)) return null;
    return (
      people
        .filter((item) => item.name === person.name)
        .findIndex((item) => item.id === person.id) + 1
    );
  }

  const expectedTotal = results.reduce(
    (sum, result) => sum + result.expected,
    0,
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="투표 범위 분석 홈">
          <span className="brand-mark" aria-hidden="true">
            <BarChart3 size={20} strokeWidth={2.3} />
          </span>
          <span>VOTE SCOPE</span>
        </a>
        <div className="topbar-actions">
          <span className="privacy-note">
            <LockKeyhole size={14} aria-hidden="true" />
            브라우저 안에서만 계산
          </span>
          <button className="ghost-button" type="button" onClick={resetAll}>
            <RefreshCcw size={15} aria-hidden="true" />
            전체 초기화
          </button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="eyebrow">
            후보 수 자유 설정 · 실시간 범위 분석
          </span>
          <h1>
            투표의 가능성을,
            <br />
            <span>하나의 범위로.</span>
          </h1>
          <p>
            각 사람이 투표할 가능성이 있는 후보를 모두 표시하면 확정 최소표부터
            평균 예상표, 가능 최대표까지 바로 계산해 드려요.
          </p>
        </div>
        <div className="hero-summary" aria-label="현재 명단 진행 상황">
          <div className="summary-orbit" aria-hidden="true">
            <span className="orbit-dot orbit-a" />
            <span className="orbit-dot orbit-b" />
            <span className="orbit-dot orbit-c" />
            <span className="orbit-dot orbit-d" />
            <strong>{people.length}</strong>
            <small>전체 인원</small>
          </div>
          <div className="summary-copy">
            <span>현재 진행률 · 후보 {candidates.length}개</span>
            <strong>
              {completedPeople.length}
              <small> / {people.length}명</small>
            </strong>
            <div className="summary-progress" aria-hidden="true">
              <span
                style={{
                  width: `${
                    people.length
                      ? (completedPeople.length / people.length) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
            <p>
              {incompleteCount
                ? `${incompleteCount}명 선택 대기 중`
                : people.length
                  ? "모든 선택 완료"
                  : "명단을 먼저 입력해 주세요"}
            </p>
          </div>
        </div>
      </section>

      <div className="workspace-grid">
        <div className="work-column">
          <section className="panel setup-panel" aria-labelledby="candidate-heading">
            <div className="section-heading">
              <span className="step-number">01</span>
              <div>
                <h2 id="candidate-heading">후보 설정</h2>
                <p>후보 수를 조절하고 이름을 자유롭게 지정하세요.</p>
              </div>
              <span className="count-chip">{candidates.length}개 후보</span>
            </div>

            <div className="candidate-input-grid">
              {candidates.map((candidate) => (
                <div
                  className="candidate-input-card"
                  key={candidate.id}
                  style={candidateStyle(candidate)}
                >
                  <span className="candidate-letter" aria-hidden="true">
                    {candidate.letter}
                  </span>
                  <label>
                    <span className="sr-only">
                      {candidate.letter} 후보 이름
                    </span>
                    <input
                      type="text"
                      value={candidate.name}
                      maxLength={30}
                      onChange={(event) =>
                        updateCandidateName(candidate.id, event.target.value)
                      }
                      aria-invalid={invalidCandidateIds.has(candidate.id)}
                      aria-describedby={
                        invalidCandidateIds.has(candidate.id)
                          ? "candidate-name-warning"
                          : undefined
                      }
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeCandidate(candidate.id)}
                    disabled={candidates.length <= MIN_CANDIDATES}
                    aria-label={`${candidate.name || candidate.letter} 후보 삭제`}
                    title={
                      candidates.length <= MIN_CANDIDATES
                        ? `후보는 최소 ${MIN_CANDIDATES}개가 필요해요`
                        : "후보 삭제"
                    }
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              ))}
              <button
                className="add-candidate-button"
                type="button"
                onClick={addCandidate}
                disabled={candidates.length >= MAX_CANDIDATES}
              >
                <Plus size={17} aria-hidden="true" />
                후보 추가
              </button>
            </div>
            <div className="candidate-footnote">
              <span>최소 {MIN_CANDIDATES}개 · 최대 {MAX_CANDIDATES}개</span>
              {candidateNameIssue && (
                <p
                  className="inline-warning"
                  id="candidate-name-warning"
                  role="alert"
                >
                  <Info size={15} aria-hidden="true" />
                  비어 있거나 같은 후보 이름이 있어요. 서로 다르게 입력해 주세요.
                </p>
              )}
            </div>
          </section>

          <section className="panel names-panel" aria-labelledby="names-heading">
            <div className="section-heading">
              <span className="step-number">02</span>
              <div>
                <h2 id="names-heading">명단 불러오기</h2>
                <p>한 줄에 이름 하나씩, TXT 또는 직접 입력으로 준비하세요.</p>
              </div>
              {people.length > 0 && (
                <span className="count-chip">{people.length}명</span>
              )}
            </div>

            <div className="mode-switch" role="group" aria-label="명단 입력 방법">
              <button
                type="button"
                aria-pressed={inputMode === "text"}
                className={inputMode === "text" ? "active" : ""}
                onClick={() => setInputMode("text")}
              >
                <FileText size={16} aria-hidden="true" />
                직접 입력
              </button>
              <button
                type="button"
                aria-pressed={inputMode === "file"}
                className={inputMode === "file" ? "active" : ""}
                onClick={() => setInputMode("file")}
              >
                <UploadCloud size={16} aria-hidden="true" />
                TXT 불러오기
              </button>
            </div>

            {inputMode === "text" ? (
              <div className="text-entry">
                <label htmlFor="name-list">이름 명단</label>
                <textarea
                  id="name-list"
                  value={namesText}
                  onChange={(event) => setNamesText(event.target.value)}
                  placeholder={"김하늘\n박지민\n이서준\n최유나"}
                  rows={6}
                  spellCheck={false}
                />
                <div className="entry-actions">
                  <span>
                    빈 줄은 제외 · 최대 {MAX_PEOPLE.toLocaleString("ko-KR")}명
                  </span>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={applyNames}
                  >
                    명단 적용하기
                    <ChevronRight size={17} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`drop-zone ${isDragging ? "dragging" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <div className="upload-icon" aria-hidden="true">
                  <UploadCloud size={24} />
                </div>
                <strong>TXT 파일을 여기에 놓으세요</strong>
                <p>또는 파일을 찾아 명단을 한 번에 불러오세요.</p>
                <button
                  className="outline-button"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  TXT 파일 선택
                </button>
                <input
                  ref={fileInputRef}
                  className="sr-only"
                  type="file"
                  accept=".txt,text/plain"
                  onChange={handleFileChange}
                />
                <small>
                  <LockKeyhole size={12} aria-hidden="true" />
                  파일은 외부로 전송되지 않아요 · 최대 2MB
                </small>
              </div>
            )}

            <p className="status-message" aria-live="polite">
              {message}
            </p>
          </section>

          <section
            className="panel predictions-panel"
            aria-labelledby="predictions-heading"
          >
            <div className="section-heading prediction-heading">
              <span className="step-number">03</span>
              <div>
                <h2 id="predictions-heading">개인별 예상 선택</h2>
                <p>실제로 투표할 가능성이 있는 후보를 1개 이상 선택하세요.</p>
              </div>
            </div>

            {people.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon" aria-hidden="true">
                  <Users size={26} />
                </span>
                <strong>아직 명단이 없어요</strong>
                <p>위에서 TXT 파일을 불러오거나 이름을 직접 입력해 주세요.</p>
              </div>
            ) : (
              <>
                <div className="prediction-toolbar">
                  <div className="progress-copy">
                    <strong>완료 {completedPeople.length}명</strong>
                    <span>전체 {people.length}명</span>
                    {incompleteCount > 0 && (
                      <em>미선택 {incompleteCount}명</em>
                    )}
                  </div>
                  <div className="toolbar-controls">
                    <label className="search-box">
                      <Search size={15} aria-hidden="true" />
                      <span className="sr-only">이름 검색</span>
                      <input
                        type="search"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="이름 검색"
                      />
                    </label>
                    <label className="filter-check">
                      <input
                        type="checkbox"
                        checked={onlyIncomplete}
                        onChange={(event) =>
                          setOnlyIncomplete(event.target.checked)
                        }
                      />
                      미선택만
                    </label>
                  </div>
                </div>

                {duplicateNames.size > 0 && (
                  <p className="duplicate-note">
                    같은 이름이 있어 번호로 구분했어요. 서로 다른 사람이라면 그대로
                    사용해도 돼요.
                  </p>
                )}

                <div className="table-wrap">
                  <table className="prediction-table">
                    <caption className="sr-only">
                      사람별로 투표 가능성이 있는 후보를 하나 이상 선택하는 표
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">이름</th>
                        {candidates.map((candidate) => (
                          <th scope="col" key={candidate.id}>
                            <span
                              className="table-team"
                              style={candidateStyle(candidate)}
                            >
                              <b>{candidate.letter}</b>
                              {candidate.name.trim() || "이름 없음"}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePeople.map((person) => {
                        const duplicateIndex = getDuplicateIndex(person);
                        return (
                          <tr
                            key={person.id}
                            className={
                              person.picks.length === 0 ? "incomplete-row" : ""
                            }
                          >
                            <th scope="row">
                              <div className="person-name">
                                <span>
                                  {person.name}
                                  {duplicateIndex && (
                                    <small> ({duplicateIndex})</small>
                                  )}
                                </span>
                                {person.picks.length === 0 && <em>미선택</em>}
                                <button
                                  type="button"
                                  onClick={() => removePerson(person.id)}
                                  aria-label={`${person.name} 명단에서 삭제`}
                                  title="명단에서 삭제"
                                >
                                  <Trash2 size={15} aria-hidden="true" />
                                </button>
                              </div>
                            </th>
                            {candidates.map((candidate) => {
                              const checked = person.picks.includes(candidate.id);
                              return (
                                <td key={candidate.id}>
                                  <label
                                    className={`pick-chip ${
                                      checked ? "selected" : ""
                                    }`}
                                    style={candidateStyle(candidate)}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() =>
                                        togglePick(person.id, candidate.id)
                                      }
                                      aria-label={`${person.name}, ${
                                        candidate.name || candidate.letter
                                      } 선택 가능`}
                                    />
                                    <span className="pick-check" aria-hidden="true">
                                      {checked ? (
                                        <Check size={15} strokeWidth={3} />
                                      ) : (
                                        candidate.letter
                                      )}
                                    </span>
                                    <span className="pick-name">
                                      {candidate.name.trim() || "이름 없음"}
                                    </span>
                                  </label>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {visiblePeople.length === 0 && (
                    <div className="no-filter-results">
                      조건에 맞는 이름이 없어요.
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>

        <aside
          className="results-panel"
          ref={resultsRef}
          aria-labelledby="results-heading"
        >
          <div className="results-topline">
            <div>
              <span className="result-kicker">LIVE ANALYSIS</span>
              <h2 id="results-heading">예상 결과</h2>
            </div>
            <span className="basis-chip">
              {completedPeople.length
                ? `완료 ${completedPeople.length}명 기준`
                : "선택 대기 중"}
            </span>
          </div>

          <p className="results-description">
            여러 후보를 선택한 경우 한 사람의 1표를 같은 비율로 나누어 계산해요.
          </p>

          {incompleteCount > 0 && people.length > 0 && (
            <div className="incomplete-banner">
              <Info size={16} aria-hidden="true" />
              <span>
                <strong>{incompleteCount}명</strong>은 아직 선택이 없어 현재 결과에서
                제외됐어요.
              </span>
            </div>
          )}

          <div className="result-list" aria-live="polite">
            {results.map((result) => {
              const total = completedPeople.length;
              const minPercent = total ? (result.min / total) * 100 : 0;
              const expectedPercent = total
                ? (result.expected / total) * 100
                : 0;
              const maxPercent = total ? (result.max / total) * 100 : 0;
              const scorePercent = total ? (result.score / total) * 100 : 0;

              return (
                <article
                  className={`result-card ${
                    result.rank === 1 && total ? "leader" : ""
                  }`}
                  key={result.id}
                  style={candidateStyle(result)}
                >
                  <div className="result-card-head">
                    <span className="rank-badge">
                      {total
                        ? `${result.isTie ? "공동 " : ""}${result.rank}위`
                        : "—"}
                    </span>
                    <div className="result-name">
                      <span>{result.letter}</span>
                      <strong>{result.name.trim() || "이름 없음"}</strong>
                    </div>
                    <div className="score-value">
                      <small>종합 순위값</small>
                      <strong>{formatNumber(result.score)}</strong>
                    </div>
                  </div>

                  <div className="expected-line">
                    <span>평균 예상</span>
                    <strong>{formatNumber(result.expected)}표</strong>
                    <em>{expectedPercent.toFixed(1)}%</em>
                  </div>

                  <div className="range-labels" aria-hidden="true">
                    <span>최소 {result.min}</span>
                    <span>최대 {result.max}</span>
                  </div>
                  <div
                    className="range-track"
                    role="img"
                    aria-label={`${result.name || result.letter}: 최소 ${
                      result.min
                    }표, 평균 예상 ${formatNumber(
                      result.expected,
                    )}표, 최대 ${result.max}표`}
                  >
                    <span
                      className="range-fill"
                      style={{
                        left: `${minPercent}%`,
                        width: `${Math.max(0, maxPercent - minPercent)}%`,
                      }}
                    />
                    <span
                      className="range-min"
                      style={{ left: `${minPercent}%` }}
                    />
                    <span
                      className="range-max"
                      style={{ left: `${maxPercent}%` }}
                    />
                    <span
                      className="range-expected"
                      style={{ left: `${expectedPercent}%` }}
                    />
                  </div>

                  <div className="result-stats">
                    <div>
                      <span>확정 최소표</span>
                      <strong>{result.min}</strong>
                    </div>
                    <div>
                      <span>평균 예상표</span>
                      <strong>{formatNumber(result.expected)}</strong>
                    </div>
                    <div>
                      <span>가능 최대표</span>
                      <strong>{result.max}</strong>
                    </div>
                  </div>

                  <div className="score-meter" aria-hidden="true">
                    <span
                      style={{ width: `${Math.min(100, scorePercent)}%` }}
                    />
                  </div>
                </article>
              );
            })}
          </div>

          <details className="formula-box">
            <summary>
              <Info size={16} aria-hidden="true" />
              계산 기준 알아보기
              <ChevronRight
                size={16}
                className="detail-chevron"
                aria-hidden="true"
              />
            </summary>
            <div>
              <p>
                <strong>최소표</strong>는 해당 후보만 고른 인원입니다.
              </p>
              <p>
                <strong>평균 예상표</strong>는 1표를 선택한 후보 수만큼 균등하게
                나눈 합계입니다.
              </p>
              <p>
                <strong>최대표</strong>는 해당 후보를 가능 선택으로 포함한 모든
                인원입니다.
              </p>
              <p className="formula">
                종합 순위값 = (최소표 + 평균 예상표 + 최대표) ÷ 3
              </p>
              <small>
                종합 순위값은 소수 둘째 자리에서 반올림하며, 같은 값은 공동
                순위입니다. 실제 득표수가 아닌 후보 간 비교용 점수예요.
              </small>
            </div>
          </details>

          {completedPeople.length > 0 && (
            <p className="integrity-check">
              <Check size={14} aria-hidden="true" />
              평균 예상표 합계 {formatNumber(expectedTotal)}표 · 완료 인원과 일치
            </p>
          )}
        </aside>
      </div>

      {people.length > 0 && (
        <button
          className="mobile-results-button"
          type="button"
          onClick={() =>
            resultsRef.current?.scrollIntoView({ behavior: "smooth" })
          }
        >
          결과 보기
          <span>
            {incompleteCount ? `미선택 ${incompleteCount}명` : "입력 완료"}
          </span>
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      )}

      <footer>
        <LockKeyhole size={14} aria-hidden="true" />
        입력한 이름과 파일은 서버에 저장되거나 전송되지 않습니다.
      </footer>
    </main>
  );
}
