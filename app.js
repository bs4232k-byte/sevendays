// 세븐데이즈 — 앱 로직 (서버 없이 폰 안에 저장)
const STORE_KEY = 'sevendays.v1';
const $app = document.getElementById('app');

// ---------- 저장 ----------
function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || null; } catch (e) { return null; }
}
let S = load() || { profile: null, startDate: null, schedule: DEFAULT_SCHEDULE.slice(), days: {} };
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* 저장 공간 없음 */ }
}

// ---------- 유틸 ----------
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n).toLocaleString('ko-KR');
function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function todayN() {
  if (!S.startDate) return 1;
  const diff = Math.round((parseYmd(ymd(new Date())) - parseYmd(S.startDate)) / 86400000);
  return diff + 1; // 8 이상이면 7일 완주
}
function dateOf(n) { const d = parseYmd(S.startDate); d.setDate(d.getDate() + n - 1); return d; }
function day(n) {
  if (!S.days[n]) S.days[n] = { sets: {}, meals: {}, menu: {}, checks: {}, water: 0, weight: null, workoutDone: false, moved: false };
  return S.days[n];
}

// 목표 칼로리 · 단백질 (Mifflin-St Jeor, 활동계수 1.4, 하루 -500kcal)
function targets() {
  const p = S.profile;
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'f' ? -161 : 5);
  const floor = p.sex === 'f' ? 1200 : 1500;
  return {
    bmr: Math.round(bmr),
    kcal: Math.max(floor, Math.round((bmr * 1.4 - 500) / 50) * 50),
    protein: Math.round((p.weight * 2) / 5) * 5,
  };
}

function menuOf(n, slot) {
  const d = day(n);
  const opts = MEALS[slot];
  const i = d.menu[slot] != null ? d.menu[slot] : (n - 1) % opts.length;
  return opts[i % opts.length];
}
function eatenTotals(n) {
  const d = day(n);
  let kcal = 0, p = 0, count = 0;
  MEAL_SLOTS.forEach((m) => { if (d.meals[m.id]) { const x = menuOf(n, m.id); kcal += x.kcal; p += x.p; count++; } });
  return { kcal, p, count };
}
function planTotals(n) {
  let kcal = 0, p = 0;
  MEAL_SLOTS.forEach((m) => { const x = menuOf(n, m.id); kcal += x.kcal; p += x.p; });
  return { kcal, p };
}

function status(n) {
  const N = todayN();
  const d = day(n);
  const type = S.schedule[n - 1];
  if (d.workoutDone) return 'done';
  if (n === N) return 'today';
  if (n > N) return 'next';
  if (d.moved) return 'moved';
  if (LIGHT_DAYS.includes(type)) return 'light';
  return 'missed';
}
function missedDays() {
  const out = [];
  for (let n = 1; n <= 7; n++) if (status(n) === 'missed') out.push(n);
  return out;
}

// 놓친 운동을 남은 회복 데이로 옮기기
function reschedule() {
  const N = Math.min(todayN(), 7);
  const missed = missedDays();
  const slots = [];
  for (let n = N; n <= 7; n++) if (S.schedule[n - 1] === 'recovery' && !day(n).workoutDone) slots.push(n);
  let moved = 0;
  missed.forEach((m, i) => {
    if (i < slots.length) {
      S.schedule[slots[i] - 1] = S.schedule[m - 1];
      day(m).moved = true;
      moved++;
    }
  });
  save();
  return { moved, left: missed.length - moved };
}

// ---------- 냉장고 ----------
function fridge() { if (!Array.isArray(S.fridge)) S.fridge = []; return S.fridge; }
function missingFor(meal) { const f = fridge(); return (meal.needs || []).filter((id) => !f.includes(id)); }

// 냉장고 재료로 오늘부터 남은 식단 다시 짜기 (이미 먹은 끼니는 그대로)
function planFromFridge() {
  const N = Math.min(Math.max(todayN(), 1), 7);
  let ready = 0, total = 0;
  MEAL_SLOTS.forEach((m) => {
    const opts = MEALS[m.id].map((x, i) => ({ i, miss: missingFor(x).length }));
    const min = Math.min(...opts.map((o) => o.miss));
    let pool = opts.filter((o) => o.miss === min);
    if (pool.length < 2) {
      const rest = opts.filter((o) => o.miss > min).sort((a, b) => a.miss - b.miss);
      if (rest.length && rest[0].miss <= min + 1) pool = pool.concat(rest.filter((o) => o.miss === rest[0].miss));
    }
    pool.sort((a, b) => a.miss - b.miss || a.i - b.i);
    let k = 0;
    for (let n = N; n <= 7; n++) {
      const d = day(n);
      if (d.meals[m.id]) continue;
      const pick = pool[k % pool.length]; k++;
      d.menu[m.id] = pick.i;
      total++; if (pick.miss === 0) ready++;
    }
  });
  save();
  return { ready, total };
}

// 남은 식단에 필요한데 냉장고에 없는 재료 → 장보기 목록
function shoppingList() {
  const N = Math.min(Math.max(todayN(), 1), 7);
  const need = {};
  for (let n = N; n <= 7; n++) {
    MEAL_SLOTS.forEach((m) => {
      if (day(n).meals[m.id]) return;
      const x = menuOf(n, m.id);
      missingFor(x).forEach((id) => {
        need[id] = need[id] || { id, name: INGREDIENT_NAME[id], uses: 0, menus: new Set() };
        need[id].uses++; need[id].menus.add(x.name.split(' + ')[0]);
      });
    });
  }
  return Object.values(need).sort((a, b) => b.uses - a.uses);
}

// ---------- 공통 조각 ----------
const icon = {
  back: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  close: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  chev: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  check: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
  home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 11l9-7 9 7v9H3z"/></svg>',
  cal: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  fridge: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 10h14M9 5v2M9 13v3"/></svg>',
  chart: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
};
function nav(active) {
  const item = (href, key, ic, label) => `<a href="${href}" class="tab${active === key ? ' on' : ''}">${ic}<span>${label}</span></a>`;
  return `<nav class="tabbar">${item('#home', 'home', icon.home, '홈')}${item('#plan', 'plan', icon.cal, '7일 플랜')}${item('#progress', 'progress', icon.chart, '기록')}</nav>`;
}
function topbar(href, label, right) {
  return `<header class="topbar"><a class="iconbtn" href="${href}" aria-label="뒤로">${icon.back}</a><div class="topbar-t">${label}</div>${right || ''}</header>`;
}

// ---------- 화면: 온보딩 ----------
function viewOnboard() {
  const p = S.profile || { name: '', height: '', weight: '', age: '', sex: 'm', goals: ['face', 'fat'], gymTime: '19:30' };
  const goal = (id, t, s) => `<button type="button" class="goal${p.goals.includes(id) ? ' on' : ''}" data-act="goal" data-id="${id}"><span><b>${t}</b><small>${s}</small></span>${icon.check}</button>`;
  return `<main class="screen pad">
    <div class="eyebrow">SEVEN DAYS</div>
    <h1 class="h1">${S.profile ? '내 정보 수정' : '7일만 루틴에<br>맡겨볼까요?'}</h1>
    <p class="muted">의지가 바닥일 때, 오늘 먹을 것과 할 운동을 대신 정해줄게요.</p>
    <form id="onboard" class="stack">
      <label class="field">이름<input name="name" value="${esc(p.name)}" placeholder="예: 범수" required></label>
      <div class="grid3">
        <label class="field">키(cm)<input name="height" type="number" inputmode="decimal" value="${esc(p.height)}" required></label>
        <label class="field">체중(kg)<input name="weight" type="number" step="0.1" inputmode="decimal" value="${esc(p.weight)}" required></label>
        <label class="field">나이<input name="age" type="number" inputmode="numeric" value="${esc(p.age)}" required></label>
      </div>
      <div class="grid2">
        <label class="field">성별<select name="sex"><option value="m"${p.sex !== 'f' ? ' selected' : ''}>남성</option><option value="f"${p.sex === 'f' ? ' selected' : ''}>여성</option></select></label>
        <label class="field">헬스장 가는 시간<input name="gymTime" type="time" value="${esc(p.gymTime)}"></label>
      </div>
      <div class="label">이번 7일 목표</div>
      <div class="stack-s" id="goals">
        ${goal('face', '볼살 · 턱선 정리', '붓기 관리 + 체지방 감량')}
        ${goal('fat', '체지방 감량', '근육은 지키면서 지방만')}
        ${goal('routine', '생활 루틴 회복', '수면 · 식사 시간 고정')}
      </div>
      <p class="note">볼살만 따로 빼는 운동은 없어요. 체지방 감량과 붓기 관리로 함께 접근해요.</p>
      <button class="cta" type="submit">${S.profile ? '저장하기' : '내 7일 플랜 만들기'}</button>
    </form>
  </main>`;
}

// ---------- 화면: 홈 ----------
function viewHome() {
  const N = todayN();
  if (N > 7) return viewFinish();
  const p = S.profile, t = targets(), d = day(N);
  const w = WORKOUTS[S.schedule[N - 1]];
  const eaten = eatenTotals(N);
  const nextMeal = MEAL_SLOTS.find((m) => !d.meals[m.id]);
  const segs = [1, 2, 3, 4, 5, 6, 7].map((n) => `<div class="seg ${status(n)}"></div>`).join('');
  const missed = missedDays();
  const checks = FACE_CHECKS.map((c) => {
    const on = c.id === 'water' ? d.water >= 10 : !!d.checks[c.id];
    const extra = c.id === 'water'
      ? `<span class="water"><button type="button" class="mini" data-act="water" data-d="-1" aria-label="물 한 잔 빼기">−</button><b>${d.water} / 10잔</b><button type="button" class="mini" data-act="water" data-d="1" aria-label="물 한 잔 더하기">+</button></span>`
      : '';
    return `<div class="checkrow"><label><input type="checkbox" data-act="check" data-id="${c.id}"${on ? ' checked' : ''}${c.id === 'water' ? ' disabled' : ''}>${c.label}</label>${extra}</div>`;
  }).join('');
  return `<main class="screen pad">
    <div class="row between"><span class="muted">${DOW[new Date().getDay()]}요일 · ${esc(p.name)}님</span><span class="eyebrow">SEVEN DAYS</span></div>
    <div class="dayhead">DAY ${N}<span> / 7</span></div>
    <p class="lead">의지 대신 루틴이 움직이게. 오늘도 시간표대로만.</p>
    <div class="segs">${segs}</div>
    ${missed.length ? `<a class="banner" href="#progress">놓친 운동 ${missed.length}개가 있어요 · 남은 일정 다시 짜기 ${icon.chev}</a>` : ''}
    <a class="card-hi" href="#workout/${N}">
      <div class="row between small"><b>${w.minutes ? '오늘의 운동 · ' + esc(p.gymTime) + ' 헬스장' : '오늘은 휴식'}</b>${icon.chev}</div>
      <div class="card-hi-t">${w.title}</div>
      <div class="row gap small">${d.workoutDone ? '<b>완료했어요</b>' : `<span>${w.minutes ? w.minutes + '분' : '체크인'}</span><span>${w.sub}</span>`}</div>
    </a>
    <div class="grid2">
      <a class="tile" href="#day/${N}"><span class="muted s">오늘 식단</span><span class="num">${fmt(eaten.kcal)}<small> / ${fmt(t.kcal)}</small></span><span class="muted s">kcal · ${eaten.count}/4끼</span></a>
      <a class="tile" href="${nextMeal ? `#meal/${N}/${nextMeal.id}` : `#day/${N}`}"><span class="muted s">단백질</span><span class="num">${eaten.p}<small> / ${t.protein}g</small></span><span class="muted s">${nextMeal ? '다음: ' + nextMeal.label.split(' ')[0] : '오늘 식단 완료'}</span></a>
    </div>
    <a class="banner" href="#fridge"><span>${icon.fridge} ${fridge().length ? `냉장고 재료 ${fridge().length}개 · 식단 다시 맞추기` : '냉장고 재료로 식단 맞추기'}</span>${icon.chev}</a>
    <section class="box">
      <div class="row between"><b>볼살 붓기 체크</b><span class="muted s">오늘 3가지</span></div>
      ${checks}
    </section>
    <a class="ghost" href="#day/${N}">오늘 루틴 전체 보기</a>
  </main>${nav('home')}`;
}

function viewFinish() {
  let done = 0;
  for (let n = 1; n <= 7; n++) if (day(n).workoutDone) done++;
  const w1 = S.profile.weight;
  let last = null;
  for (let n = 7; n >= 1; n--) if (day(n).weight) { last = day(n).weight; break; }
  return `<main class="screen pad">
    <div class="eyebrow">7-DAY COMPLETE</div>
    <h1 class="h1">7일을 지나왔어요</h1>
    <div class="grid2">
      <div class="tile"><span class="muted s">운동한 날</span><span class="num">${done}<small> / 7</small></span></div>
      <div class="tile"><span class="muted s">체중</span><span class="num">${last ? last : '—'}<small>kg</small></span><span class="muted s">시작 ${w1}kg</span></div>
    </div>
    <p class="note">숫자보다 중요한 건 “7일 동안 루틴을 다시 굴려봤다”는 경험이에요. 같은 시간 · 같은 조명에서 얼굴 사진도 한 장 찍어두세요.</p>
    <button class="cta" data-act="restart">다음 7일 시작하기</button>
  </main>${nav('home')}`;
}

// ---------- 화면: 7일 플랜 ----------
function viewPlan() {
  const t = targets();
  const label = { done: '완료', today: '오늘', next: '예정', moved: '옮김', light: '지남', missed: '놓침' };
  const rows = [1, 2, 3, 4, 5, 6, 7].map((n) => {
    const st = status(n), w = WORKOUTS[S.schedule[n - 1]], dt = dateOf(n);
    return `<a href="#day/${n}" class="dayrow ${st}">
      <div class="dayrow-n"><small>${DOW[dt.getDay()]}</small><b>${n}</b></div>
      <div class="grow"><b>${w.title}</b><small>${w.sub}</small></div>
      <span class="badge">${label[st]}</span></a>`;
  }).join('');
  return `<main class="screen pad">
    <div class="eyebrow">7-DAY RESET</div>
    <h1 class="h1">${esc(S.profile.name)}님의 7일 플랜</h1>
    <p class="lead">하루 ${fmt(t.kcal)}kcal · 단백질 ${t.protein}g · 운동 주 5회</p>
    <div class="stack-s">${rows}</div>
    <a class="ghost" href="#fridge">냉장고 재료로 식단 맞추기</a>
    <p class="note dashed">하루를 놓쳐도 괜찮아요. 기록 탭에서 남은 회복 데이에 운동을 다시 배치할 수 있어요.</p>
  </main>${nav('plan')}`;
}

// ---------- 화면: 데일리 타임라인 ----------
function viewDay(n) {
  if (!(n >= 1 && n <= 7)) return viewHome();
  const d = day(n), t = targets(), w = WORKOUTS[S.schedule[n - 1]], pt = planTotals(n);
  const items = MEAL_SLOTS.map((m) => {
    const x = menuOf(n, m.id);
    return { time: m.time, tag: m.label + (d.meals[m.id] ? ' · 완료' : ''), meta: x.kcal + 'kcal', title: x.name, sub: `단백질 ${x.p}g · ${x.min}분`, href: `#meal/${n}/${m.id}`, done: d.meals[m.id] };
  });
  if (w.minutes) items.splice(3, 0, { time: S.profile.gymTime, tag: '운동 · 헬스장' + (d.workoutDone ? ' · 완료' : ''), meta: w.minutes + '분', title: w.title, sub: d.workoutDone ? '수고했어요' : '시작하기 →', href: `#workout/${n}`, hi: !d.workoutDone });
  else items.splice(3, 0, { time: '20:00', tag: '휴식 · 체크인', meta: '', title: w.title, sub: '체중 기록하러 가기 →', href: '#progress' });
  items.push({ time: '23:30', tag: '취침 준비', meta: '7시간', title: '휴대폰 내려놓기 · 물 한 잔', sub: '수면 부족은 다음 날 붓기와 식욕을 키워요' });
  items.sort((a, b) => a.time.localeCompare(b.time));
  const dt = dateOf(n);
  return `<main class="screen pad">
    ${topbar('#plan', `<small>DAY ${n} · ${DOW[dt.getDay()]}요일</small><b>하루 루틴</b>`)}
    <div class="row gap wrap"><span class="pill on">${fmt(pt.kcal)} / ${fmt(t.kcal)}kcal</span><span class="pill">단백질 ${pt.p}g</span><span class="pill">나트륨 2,000mg↓</span></div>
    <div class="timeline">${items.map((it) => `
      <div class="tl">
        <div class="tl-time"><b>${it.time}</b><i></i></div>
        ${it.href ? `<a href="${it.href}" class="tl-card${it.hi ? ' hi' : ''}${it.done ? ' done' : ''}">` : '<div class="tl-card">'}
          <div class="row between s"><span>${it.tag}</span><span>${it.meta}</span></div>
          <b>${it.title}</b><small>${it.sub}</small>
        ${it.href ? '</a>' : '</div>'}
      </div>`).join('')}
    </div>
  </main>`;
}

// ---------- 화면: 운동 ----------
let timer = { left: 0, id: null };
function viewWorkout(n) {
  if (!(n >= 1 && n <= 7)) return viewHome();
  const d = day(n), w = WORKOUTS[S.schedule[n - 1]];
  if (!w.minutes) {
    return `<main class="screen pad">${topbar('#home', `<small>DAY ${n}</small><b>${w.title}</b>`)}
      <p class="lead">오늘은 쉬는 날이에요. 아침 체중을 기록하고, 다음 7일을 준비해요.</p>
      <a class="cta" href="#progress">체중 기록하러 가기</a></main>`;
  }
  let total = 0, doneSets = 0;
  const list = w.exercises.map((ex, i) => {
    const arr = d.sets[i] || [];
    total += ex.sets;
    const chips = Array.from({ length: ex.sets }, (_, s) => { if (arr[s]) doneSets++; return `<button type="button" class="setchip${arr[s] ? ' on' : ''}" data-act="set" data-ex="${i}" data-s="${s}" aria-label="${ex.name} ${s + 1}세트">${s + 1}</button>`; }).join('');
    const allDone = arr.filter(Boolean).length === ex.sets;
    return `<div class="ex${allDone ? ' done' : ''}"><div class="row between"><b>${ex.name}</b><span class="muted s">${ex.sets > 1 ? ex.sets + ' × ' : ''}${ex.reps}</span></div><div class="row gap-s">${chips}</div></div>`;
  }).join('');
  const pct = Math.round((doneSets / total) * 100);
  return `<main class="screen pad">
    ${topbar('#home', `<small>DAY ${n} · 헬스장</small><b>${w.title}</b>`, `<span class="muted s">${doneSets}/${total}세트</span>`)}
    <div class="bar"><i style="width:${pct}%"></i></div>
    <div class="timerbox"><span class="muted">세트 사이 휴식</span><span id="timer" class="num big">${fmtTimer(timer.left || 90)}</span><button type="button" class="mini wide" data-act="timer">${timer.id ? '정지' : '90초 시작'}</button></div>
    <div class="stack-s">${list}</div>
    <p class="note">세트 번호를 누르면 완료로 표시돼요. 무게는 마지막 2회가 힘들 정도로 골라요.</p>
    <button class="cta" data-act="finishWorkout" data-n="${n}">${d.workoutDone ? '완료 취소' : '오늘 운동 완료'}</button>
  </main>`;
}
function fmtTimer(s) { return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
function toggleTimer() {
  if (timer.id) { clearInterval(timer.id); timer = { left: 0, id: null }; render(); return; }
  timer.left = 90;
  timer.id = setInterval(() => {
    timer.left--;
    const el = document.getElementById('timer');
    if (el) el.textContent = fmtTimer(Math.max(timer.left, 0));
    if (timer.left <= 0) {
      clearInterval(timer.id); timer = { left: 0, id: null };
      if (navigator.vibrate) navigator.vibrate([300, 120, 300]);
      render();
    }
  }, 1000);
  render();
}

// ---------- 화면: 식단 ----------
function viewMeal(n, slot) {
  const m = MEAL_SLOTS.find((x) => x.id === slot);
  if (!(n >= 1 && n <= 7) || !m) return viewHome();
  const d = day(n), x = menuOf(n, slot);
  return `<main class="screen pad">
    ${topbar('#day/' + n, `<small>DAY ${n} · ${m.time}</small><b>${m.label}</b>`)}
    <h1 class="h2">${x.name}</h1>
    <p class="muted">집에서 ${x.min}분 · 1인분</p>
    <div class="grid4">
      <div class="macro hi"><small>kcal</small><b>${x.kcal}</b></div>
      <div class="macro"><small>단백질</small><b>${x.p}g</b></div>
      <div class="macro"><small>탄수</small><b>${x.c}g</b></div>
      <div class="macro"><small>지방</small><b>${x.f}g</b></div>
    </div>
    <section class="stack-s"><b>재료</b><p class="body">${x.ingredients}</p>
      ${fridge().length ? (missingFor(x).length
        ? `<a class="banner" href="#shop"><span>냉장고에 없는 재료: ${missingFor(x).map((id) => INGREDIENT_NAME[id]).join(', ')}</span>${icon.chev}</a>`
        : '<p class="note"><b>냉장고 재료로 바로 만들 수 있어요</b></p>') : ''}
    </section>
    <section class="stack-s"><b>만들기</b>${x.steps.map((s, i) => `<div class="step"><b>${String(i + 1).padStart(2, '0')}</b><span>${s}</span></div>`).join('')}</section>
    ${x.tip ? `<p class="note dashed hi"><b>볼살 팁</b> ${x.tip}</p>` : ''}
    <div class="row gap bottom">
      <button class="ghost grow" data-act="swap" data-n="${n}" data-slot="${slot}">다른 메뉴로</button>
      <button class="cta grow2" data-act="eat" data-n="${n}" data-slot="${slot}">${d.meals[slot] ? '먹었어요 ✓ 취소' : '먹었어요'}</button>
    </div>
  </main>`;
}

// ---------- 화면: 냉장고 재료 체크 ----------
function viewFridge() {
  const f = fridge();
  const first = location.hash.includes('first');
  const groups = INGREDIENT_GROUPS.map((g) => `
    <section class="stack-s"><div class="label">${g.label}</div>
      <div class="chips">${g.items.map(([id, name]) => `<button type="button" class="chip${f.includes(id) ? ' on' : ''}" data-act="ing" data-id="${id}" aria-pressed="${f.includes(id)}">${name}</button>`).join('')}</div>
    </section>`).join('');
  return `<main class="screen pad">
    ${first ? '<div class="eyebrow">마지막 단계</div>' : topbar('#home', '<small>FRIDGE</small><b>냉장고 재료 체크</b>')}
    <h1 class="h1">지금 냉장고에<br>뭐가 있나요?</h1>
    <p class="lead">있는 재료를 눌러주세요. 그 재료로 남은 식단을 다시 짜고, 부족한 것만 장보기 목록으로 만들어요.</p>
    ${groups}
    <p class="note">소금 · 후추 · 기름 · 마늘 같은 기본 양념은 있다고 가정해요.</p>
    <div class="sticky-cta">
      <button class="cta" data-act="fridgePlan"><span id="fridgeCount">${f.length}</span>개 재료로 식단 짜기</button>
      ${first ? '<a class="skip" href="#home">건너뛰고 기본 식단으로 시작</a>' : ''}
    </div>
  </main>`;
}

// ---------- 화면: 장보기 목록 ----------
function viewShop() {
  const list = shoppingList();
  const N = Math.min(Math.max(todayN(), 1), 7);
  let ready = 0, total = 0;
  for (let n = N; n <= 7; n++) MEAL_SLOTS.forEach((m) => { if (day(n).meals[m.id]) return; total++; if (!missingFor(menuOf(n, m.id)).length) ready++; });
  const rows = list.map((it) => `
    <div class="shoprow">
      <div class="grow"><b>${it.name}</b><small>${Array.from(it.menus).join(' · ')} · ${it.uses}끼에 필요</small></div>
      <button type="button" class="mini wide" data-act="bought" data-id="${it.id}">샀어요</button>
    </div>`).join('');
  return `<main class="screen pad">
    ${topbar('#fridge', '<small>SHOPPING</small><b>장보기 목록</b>')}
    <div class="tile">
      <span class="muted s">남은 식단 중 지금 재료로 바로 만들 수 있는 끼니</span>
      <span class="num">${ready}<small> / ${total}끼</small></span>
      <div class="bar"><i style="width:${total ? Math.round((ready / total) * 100) : 0}%"></i></div>
    </div>
    ${list.length
      ? `<p class="lead">아래 ${list.length}가지만 사면 7일 식단이 완성돼요. 산 재료는 “샀어요”를 누르면 냉장고에 들어가요.</p><div class="stack-s">${rows}</div>`
      : '<p class="note dashed hi"><b>장볼 것 없음</b> 냉장고 재료만으로 남은 식단을 모두 만들 수 있어요.</p>'}
    <div class="row gap bottom">
      <a class="ghost grow" href="#fridge">재료 다시 고르기</a>
      <a class="cta grow2" href="#day/${N}">오늘 식단 보기</a>
    </div>
  </main>`;
}

// ---------- 화면: 기록 ----------
function viewProgress() {
  const N = Math.min(todayN(), 7);
  let done = 0;
  const circles = [1, 2, 3, 4, 5, 6, 7].map((n) => {
    const st = status(n); if (st === 'done') done++;
    return `<div class="circ ${st}"><b>${n}</b><small>${DOW[dateOf(n).getDay()]}</small></div>`;
  }).join('');
  const weights = [1, 2, 3, 4, 5, 6, 7].filter((n) => day(n).weight).map((n) => `<div class="row between s"><span>DAY ${n}</span><b>${day(n).weight}kg</b></div>`).join('');
  const missed = missedDays();
  return `<main class="screen pad">
    <div class="eyebrow">PROGRESS</div>
    <h1 class="h1">운동한 날 ${done} / 7</h1>
    <div class="circles">${circles}</div>
    <section class="box">
      <b>아침 체중 기록</b>
      <div class="grid2">
        <div class="stack-xs"><span class="muted s">시작</span><span class="num">${S.profile.weight}kg</span></div>
        <label class="field">오늘 (DAY ${N})<input id="weightIn" type="number" step="0.1" inputmode="decimal" value="${day(N).weight || ''}" placeholder="__._"></label>
      </div>
      <button class="mini wide" data-act="saveWeight" data-n="${N}">기록하기</button>
      ${weights ? `<div class="stack-xs">${weights}</div>` : ''}
      <p class="muted s">7일 동안 체중은 수분 때문에 오르내려요. 하루 숫자보다 추세만 봐요.</p>
    </section>
    <section class="box">
      <b>놓친 운동 다시 짜기</b>
      <p class="muted s">${missed.length ? `놓친 운동 ${missed.length}개 (DAY ${missed.join(', ')}) 를 남은 회복 데이로 옮겨요.` : '놓친 운동이 없어요. 잘하고 있어요.'}</p>
      ${missed.length ? '<button class="cta" data-act="reschedule">남은 일정 다시 짜기</button>' : ''}
    </section>
    <section class="box">
      <b>설정</b>
      <div class="row gap"><a class="ghost grow" href="#onboard">내 정보 수정</a><button class="ghost grow" data-act="reset">처음부터 다시</button></div>
    </section>
  </main>${nav('progress')}`;
}

// ---------- 라우터 ----------
function render() {
  if (!S.profile && location.hash !== '#onboard') { location.hash = '#onboard'; return; }
  const [route, a, b] = (location.hash.slice(1) || 'home').split('/');
  const n = Number(a);
  let html;
  switch (route) {
    case 'onboard': html = viewOnboard(); break;
    case 'plan': html = viewPlan(); break;
    case 'day': html = viewDay(n); break;
    case 'workout': html = viewWorkout(n); break;
    case 'meal': html = viewMeal(n, b); break;
    case 'progress': html = viewProgress(); break;
    case 'fridge': html = viewFridge(); break;
    case 'shop': html = viewShop(); break;
    default: html = viewHome();
  }
  $app.innerHTML = html;
}
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

// ---------- 이벤트 ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const N = Math.min(todayN(), 7);
  if (act === 'goal') {
    el.classList.toggle('on');
    return;
  }
  if (act === 'check') return; // change 이벤트에서 처리
  if (act === 'ing') {
    const f = fridge(), id = el.dataset.id, i = f.indexOf(id);
    if (i >= 0) f.splice(i, 1); else f.push(id);
    save();
    el.classList.toggle('on', i < 0); el.setAttribute('aria-pressed', String(i < 0));
    const c = document.getElementById('fridgeCount'); if (c) c.textContent = f.length;
    return;
  }
  e.preventDefault();
  if (act === 'fridgePlan') {
    if (!fridge().length) { toast('재료를 하나 이상 골라주세요'); return; }
    const r = planFromFridge(); go('#shop');
    toast(`남은 ${r.total}끼 중 ${r.ready}끼는 지금 바로 만들 수 있어요`);
    return;
  }
  if (act === 'bought') {
    const id = el.dataset.id; if (!fridge().includes(id)) fridge().push(id);
    save(); render(); toast(`${INGREDIENT_NAME[id]} 냉장고에 넣었어요`);
    return;
  }
  if (act === 'water') { const d = day(N); d.water = Math.min(12, Math.max(0, d.water + Number(el.dataset.d))); save(); render(); }
  else if (act === 'set') {
    const d = day(todayFromHash()); const i = el.dataset.ex, s = Number(el.dataset.s);
    d.sets[i] = d.sets[i] || []; d.sets[i][s] = !d.sets[i][s];
    save(); render();
    if (d.sets[i][s] && !timer.id) toggleTimer();
  }
  else if (act === 'timer') toggleTimer();
  else if (act === 'finishWorkout') { const d = day(Number(el.dataset.n)); d.workoutDone = !d.workoutDone; save(); go(d.workoutDone ? '#home' : location.hash); }
  else if (act === 'eat') { const d = day(Number(el.dataset.n)); d.meals[el.dataset.slot] = !d.meals[el.dataset.slot]; save(); go('#day/' + el.dataset.n); }
  else if (act === 'swap') {
    const n = Number(el.dataset.n), slot = el.dataset.slot, d = day(n);
    const cur = d.menu[slot] != null ? d.menu[slot] : (n - 1) % MEALS[slot].length;
    d.menu[slot] = (cur + 1) % MEALS[slot].length; save(); render();
  }
  else if (act === 'saveWeight') {
    const v = parseFloat(document.getElementById('weightIn').value);
    if (v > 20 && v < 300) { day(Number(el.dataset.n)).weight = Math.round(v * 10) / 10; save(); render(); toast('기록했어요'); }
    else toast('체중을 숫자로 입력해 주세요');
  }
  else if (act === 'reschedule') {
    const r = reschedule(); render();
    toast(r.moved ? `${r.moved}개를 회복 데이로 옮겼어요${r.left ? ` · ${r.left}개는 자리가 없어요` : ''}` : '옮길 회복 데이가 남지 않았어요. 오늘 운동에 집중해요');
  }
  else if (act === 'restart') {
    let last = null; for (let n = 7; n >= 1; n--) if (S.days[n] && S.days[n].weight) { last = S.days[n].weight; break; }
    if (last) S.profile.weight = last;
    S.startDate = ymd(new Date()); S.schedule = DEFAULT_SCHEDULE.slice(); S.days = {};
    save(); go('#home');
  }
  else if (act === 'reset') {
    if (confirm('모든 기록을 지우고 처음부터 시작할까요? 되돌릴 수 없어요.')) {
      S = { profile: null, startDate: null, schedule: DEFAULT_SCHEDULE.slice(), days: {} }; save(); go('#onboard');
    }
  }
});
function todayFromHash() { return Number(location.hash.split('/')[1]) || Math.min(todayN(), 7); }

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset && el.dataset.act === 'check') { day(Math.min(todayN(), 7)).checks[el.dataset.id] = el.checked; save(); }
});

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'onboard') return;
  e.preventDefault();
  const f = new FormData(e.target);
  const goals = Array.from(document.querySelectorAll('#goals .goal.on')).map((g) => g.dataset.id);
  const isNew = !S.profile;
  S.profile = {
    name: String(f.get('name')).trim().slice(0, 20),
    height: Number(f.get('height')), weight: Number(f.get('weight')), age: Number(f.get('age')),
    sex: f.get('sex'), gymTime: f.get('gymTime') || '19:30', goals,
  };
  if (isNew || !S.startDate) { S.startDate = ymd(new Date()); S.schedule = DEFAULT_SCHEDULE.slice(); S.days = {}; }
  save(); go(isNew ? '#fridge/first' : '#home');
});

let toastT;
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2200);
}

render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
