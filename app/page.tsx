"use client";

import {
  BarChart3,
  Check,
  ChevronRight,
  Info,
  LockKeyhole,
  RefreshCcw,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import type { CSSProperties } from "react";
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

const MIN_CANDIDATES = 1;
const FIXED_CANDIDATE_NAMES = [
  "지아지윤",
  "원겸리안",
  "훈민정원",
  "진원진우",
] as const;
const FIXED_PEOPLE_NAMES = [
  "강하연",
  "권승현",
  "김나윤",
  "김리안",
  "김슬",
  "김지유",
  "박제이",
  "박지윤",
  "박하린",
  "신예은",
  "심소율",
  "이서린",
  "정혜린",
  "최다은",
  "최지아",
  "허은",
  "김대원",
  "김민준",
  "김시우",
  "김태경",
  "김형준",
  "김훈민",
  "모준영",
  "박진우",
  "서원겸",
  "이우진",
  "이지환",
  "이진원",
  "장유한",
  "최정원",
] as const;

function candidateLetter(index: number) {
  return String.fromCharCode(65 + index);
}

function makeCandidate(index: number, name: string): Candidate {
  return {
    id: `team-${index + 1}`,
    name,
    letter: candidateLetter(index),
    ...CANDIDATE_PALETTE[index % CANDIDATE_PALETTE.length],
  };
}

const INITIAL_CANDIDATES = FIXED_CANDIDATE_NAMES.map((name, index) =>
  makeCandidate(index, name),
);

const INITIAL_PEOPLE: Person[] = FIXED_PEOPLE_NAMES.map((name, index) => ({
  id: `person-${index + 1}`,
  name,
  picks: [],
}));

function cloneInitialPeople() {
  return INITIAL_PEOPLE.map((person) => ({ ...person, picks: [] }));
}

function cloneInitialCandidates() {
  return INITIAL_CANDIDATES.map((candidate) => ({ ...candidate }));
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
  const [candidates, setCandidates] = useState<Candidate[]>(() =>
    cloneInitialCandidates(),
  );
  const [people, setPeople] = useState<Person[]>(() => cloneInitialPeople());
  const [searchTerm, setSearchTerm] = useState("");
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [message, setMessage] = useState("");
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

  function resetAll() {
    if (
      !window.confirm(
        "모든 선택 내역을 초기화할까요? 고정 후보와 명단은 유지됩니다.",
      )
    ) {
      return;
    }
    setCandidates(cloneInitialCandidates());
    setPeople(cloneInitialPeople());
    setSearchTerm("");
    setOnlyIncomplete(false);
    setMessage("선택 내역을 초기화했어요.");
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

      <div className="workspace-grid">
        <div className="work-column">
          <section className="panel setup-panel" aria-labelledby="candidate-heading">
            <div className="section-heading">
              <span className="step-number">01</span>
              <div>
                <h2 id="candidate-heading">후보 설정</h2>
                <p>고정 후보 중 필요한 후보만 남길 수 있어요.</p>
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
                      readOnly
                      aria-readonly="true"
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
            </div>
            <div className="candidate-footnote">
              <span>총 4개 고정 · 최소 {MIN_CANDIDATES}개까지 선택</span>
            </div>
          </section>

          <section className="panel names-panel" aria-labelledby="names-heading">
            <div className="section-heading">
              <span className="step-number">02</span>
              <div>
                <h2 id="names-heading">고정 명단</h2>
                <p>투표 대상 30명</p>
              </div>
              <span className="count-chip">{people.length}명</span>
            </div>
            <ol className="fixed-name-list" aria-label="고정 투표 대상 명단">
              {FIXED_PEOPLE_NAMES.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ol>
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
                <p>고정 명단을 불러오지 못했어요.</p>
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

                <div
                  className="prediction-list"
                  role="list"
                  aria-label="사람별 예상 후보 선택"
                >
                  {visiblePeople.map((person) => {
                    const duplicateIndex = duplicateNames.has(person.name)
                      ? people
                          .filter((item) => item.name === person.name)
                          .findIndex((item) => item.id === person.id) + 1
                      : null;
                    return (
                      <article
                        className={`prediction-person-card ${
                          person.picks.length === 0 ? "incomplete-row" : ""
                        }`}
                        key={person.id}
                        role="listitem"
                      >
                        <div className="person-name">
                          <span>
                            {person.name}
                            {duplicateIndex && <small> ({duplicateIndex})</small>}
                          </span>
                          {person.picks.length === 0 && <em>미선택</em>}
                        </div>

                        <div className="candidate-pick-grid">
                          {candidates.map((candidate) => {
                            const checked = person.picks.includes(candidate.id);
                            return (
                              <label
                                className={`pick-chip ${
                                  checked ? "selected" : ""
                                }`}
                                key={candidate.id}
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
                            );
                          })}
                        </div>
                      </article>
                    );
                  })}

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
