// 세븐데이즈 — 운동 · 식단 데이터
// 운동 type: 'sets' (세트 × 횟수) | 'time' (분 단위 유산소/스트레칭)

const WORKOUTS = {
  full: {
    title: '전신 적응 + 빠른 걷기',
    sub: '머신 위주 5종목 · 걷기 20분',
    minutes: 50,
    exercises: [
      { name: '레그프레스', sets: 3, reps: '12회' },
      { name: '랫풀다운', sets: 3, reps: '12회' },
      { name: '체스트프레스 머신', sets: 3, reps: '12회' },
      { name: '시티드 로우', sets: 3, reps: '12회' },
      { name: '플랭크', sets: 3, reps: '30초' },
      { name: '트레드밀 빠른 걷기', sets: 1, reps: '20분 · 6km/h' },
    ],
  },
  lower: {
    title: '하체 + 인터벌',
    sub: '레그프레스 · 런지 · 사이클 인터벌',
    minutes: 55,
    exercises: [
      { name: '레그프레스', sets: 4, reps: '12회' },
      { name: '덤벨 워킹 런지', sets: 3, reps: '양쪽 10회' },
      { name: '레그컬', sets: 3, reps: '12회' },
      { name: '힙 쓰러스트', sets: 3, reps: '12회' },
      { name: '실내 사이클 인터벌', sets: 1, reps: '30초 전력 / 90초 천천히 × 8' },
    ],
  },
  push: {
    title: '상체 밀기 + 인클라인 걷기',
    sub: '벤치 · 숄더프레스 · 걷기 20분',
    minutes: 50,
    exercises: [
      { name: '바벨 벤치프레스', sets: 4, reps: '10회' },
      { name: '덤벨 숄더프레스', sets: 3, reps: '12회' },
      { name: '인클라인 덤벨프레스', sets: 3, reps: '12회' },
      { name: '케이블 푸시다운', sets: 3, reps: '15회' },
      { name: '트레드밀 인클라인 걷기', sets: 1, reps: '20분 · 경사 10%' },
    ],
  },
  recovery: {
    title: '회복 데이',
    sub: '야외 걷기 40분 · 스트레칭',
    minutes: 55,
    exercises: [
      { name: '야외 빠른 걷기', sets: 1, reps: '40분' },
      { name: '전신 스트레칭', sets: 1, reps: '15분' },
    ],
  },
  pull: {
    title: '상체 당기기 + 로잉',
    sub: '랫풀다운 · 시티드로우 · 로잉머신',
    minutes: 50,
    exercises: [
      { name: '랫풀다운', sets: 4, reps: '10회' },
      { name: '시티드 케이블 로우', sets: 3, reps: '12회' },
      { name: '원암 덤벨 로우', sets: 3, reps: '양쪽 12회' },
      { name: '페이스풀', sets: 3, reps: '15회' },
      { name: '로잉머신 인터벌', sets: 1, reps: '15분 · 1분 빠르게 / 1분 천천히' },
    ],
  },
  circuit: {
    title: '전신 서킷',
    sub: '6종목 × 3라운드 · 45분',
    minutes: 45,
    exercises: [
      { name: '고블릿 스쿼트', sets: 3, reps: '15회' },
      { name: '푸시업', sets: 3, reps: '최대한' },
      { name: '케틀벨 스윙', sets: 3, reps: '20회' },
      { name: '덤벨 로우', sets: 3, reps: '12회' },
      { name: '마운틴 클라이머', sets: 3, reps: '30초' },
      { name: '버피', sets: 3, reps: '10회' },
    ],
  },
  rest: {
    title: '휴식 + 7일 체크인',
    sub: '체중 기록 · 다음 7일 준비',
    minutes: 0,
    exercises: [],
  },
};

// 기본 7일 분할 (Day 1 ~ Day 7)
const DEFAULT_SCHEDULE = ['full', 'lower', 'push', 'recovery', 'pull', 'circuit', 'rest'];

// 회복/휴식은 '빠진 운동'으로 치지 않음
const LIGHT_DAYS = ['recovery', 'rest'];

const MEAL_SLOTS = [
  { id: 'breakfast', label: '아침', time: '07:30' },
  { id: 'lunch', label: '점심 · 도시락', time: '12:30' },
  { id: 'snack', label: '간식', time: '16:00' },
  { id: 'dinner', label: '저녁 · 집밥', time: '21:00' },
];

// 모두 집에서 10분 안팎으로 준비 가능한 메뉴
const MEALS = {
  breakfast: [
    { name: '오트밀 우유볶음 + 바나나 + 삶은 계란 2', kcal: 640, p: 38, c: 80, f: 18, min: 5,
      ingredients: '오트밀 60g · 우유 250ml · 바나나 1개 · 계란 2개 · 땅콩버터 1작은술',
      steps: ['오트밀에 우유를 붓고 전자레인지 3분', '바나나를 썰어 올리고 땅콩버터 조금', '전날 삶아둔 계란 2개 곁들이기'] },
    { name: '그릭요거트 볼 + 통밀식빵 계란토스트', kcal: 620, p: 40, c: 70, f: 18, min: 7,
      ingredients: '그릭요거트 200g · 블루베리 한 줌 · 통밀식빵 2장 · 계란 2개',
      steps: ['요거트에 블루베리 올리기', '팬에 계란 2개 스크램블', '구운 통밀식빵에 계란 올리기'] },
    { name: '고구마 + 삶은 계란 3 + 두유', kcal: 600, p: 36, c: 72, f: 17, min: 3,
      ingredients: '찐 고구마 200g · 계란 3개 · 무가당 두유 1팩',
      steps: ['주말에 쪄둔 고구마 데우기', '삶은 계란 3개', '무가당 두유 곁들이기'] },
  ],
  lunch: [
    { name: '닭가슴살 현미밥 + 계란말이 + 김치 조금', kcal: 560, p: 45, c: 60, f: 14, min: 10,
      ingredients: '닭가슴살 1팩 · 현미밥 150g · 계란 2개 · 김치 약간',
      steps: ['전날 밤 계란말이 만들기', '현미밥과 닭가슴살 도시락에 담기', '김치는 한 젓가락만'] },
    { name: '소고기 우둔 볶음밥 + 샐러드', kcal: 580, p: 42, c: 62, f: 16, min: 12,
      ingredients: '소고기 우둔 120g · 현미밥 150g · 양파 · 파프리카 · 샐러드 채소',
      steps: ['소고기와 채소를 후추로 볶기', '현미밥 넣고 1분 더 볶기', '샐러드는 발사믹 조금'] },
    { name: '연어 포케볼', kcal: 560, p: 38, c: 58, f: 18, min: 8,
      ingredients: '훈제연어 100g · 현미밥 150g · 오이 · 양배추 · 아보카도 ¼',
      steps: ['밥 위에 채소 썰어 올리기', '훈제연어와 아보카도 얹기', '간장 대신 레몬즙 + 참깨'] },
  ],
  snack: [
    { name: '그릭요거트 + 아몬드 한 줌', kcal: 140, p: 25, c: 8, f: 6, min: 1,
      ingredients: '그릭요거트(무가당) 150g · 아몬드 10알',
      steps: ['퇴근 전 공복 방지용으로 먹기'] },
    { name: '프로틴 쉐이크 + 방울토마토', kcal: 150, p: 24, c: 10, f: 2, min: 1,
      ingredients: '프로틴 1스쿱 · 물 300ml · 방울토마토 10알',
      steps: ['물에 프로틴 섞기', '방울토마토 곁들이기'] },
  ],
  dinner: [
    { name: '두부 계란 스크램블 + 현미밥 + 브로콜리', kcal: 560, p: 36, c: 52, f: 20, min: 10,
      ingredients: '두부 200g · 계란 2개 · 현미밥 120g · 브로콜리 100g · 대파 · 들기름 1작은술',
      steps: ['브로콜리는 전자레인지 2분 데치기', '팬에 들기름, 두부 으깨 수분 날리며 3분', '계란 풀어 넣고 대파 · 후추로 마무리'],
      tip: '소금 · 간장 대신 후추와 대파로 맛을 내요. 저녁 나트륨을 줄이면 다음 날 아침 붓기가 덜해요.' },
    { name: '닭가슴살 양배추 볶음 + 현미밥', kcal: 550, p: 42, c: 55, f: 15, min: 10,
      ingredients: '닭가슴살 150g · 양배추 ¼통 · 현미밥 120g · 마늘 · 올리브유 1작은술',
      steps: ['닭가슴살 한입 크기로 썰기', '마늘 · 양배추와 함께 볶기', '후추 · 레몬즙으로 간하기'],
      tip: '양배추는 칼륨이 많아 나트륨 배출을 도와요.' },
    { name: '연어 스테이크 + 고구마 + 샐러드', kcal: 580, p: 34, c: 50, f: 24, min: 12,
      ingredients: '냉동 연어 150g · 고구마 150g · 샐러드 채소 · 레몬',
      steps: ['연어는 에어프라이어 180도 12분', '고구마는 전자레인지 5분', '샐러드에 레몬즙 뿌리기'],
      tip: '소스 없이 레몬과 후추만으로 먹어요.' },
    { name: '돼지 안심 수육 + 쌈채소 + 현미밥', kcal: 570, p: 40, c: 52, f: 18, min: 15,
      ingredients: '돼지 안심 150g · 쌈채소 · 현미밥 120g · 마늘 · 된장 ½작은술',
      steps: ['안심을 물에 15분 삶기', '얇게 썰어 쌈채소에 싸기', '쌈장 대신 된장 아주 조금 + 마늘'],
      tip: '국물 요리 대신 삶은 고기로 단백질은 채우고 나트륨은 줄여요.' },
  ],
};

// 냉장고 재료 (소금 · 후추 · 기름 · 마늘 같은 양념은 있다고 가정)
const INGREDIENT_GROUPS = [
  { label: '단백질', items: [
    ['egg', '계란'], ['tofu', '두부'], ['chicken', '닭가슴살'], ['beef', '소고기 우둔'], ['pork', '돼지 안심'],
    ['salmon', '연어'], ['greek', '그릭요거트'], ['milk', '우유'], ['soymilk', '두유'], ['protein', '프로틴 파우더'],
  ] },
  { label: '탄수화물', items: [
    ['rice', '현미밥'], ['oat', '오트밀'], ['bread', '통밀식빵'], ['sweetpotato', '고구마'], ['banana', '바나나'],
  ] },
  { label: '채소 · 과일', items: [
    ['broccoli', '브로콜리'], ['cabbage', '양배추'], ['salad', '샐러드 채소'], ['ssam', '쌈채소'], ['onion', '양파'],
    ['paprika', '파프리카'], ['cucumber', '오이'], ['tomato', '방울토마토'], ['greenonion', '대파'], ['blueberry', '블루베리'],
    ['avocado', '아보카도'], ['lemon', '레몬'],
  ] },
  { label: '기타', items: [
    ['kimchi', '김치'], ['almond', '아몬드'],
  ] },
];
const INGREDIENT_NAME = {};
INGREDIENT_GROUPS.forEach((g) => g.items.forEach(([id, name]) => { INGREDIENT_NAME[id] = name; }));

// 메뉴별 꼭 필요한 재료 (MEALS 순서와 같음)
const MEAL_NEEDS = {
  breakfast: [['oat', 'milk', 'banana', 'egg'], ['greek', 'blueberry', 'bread', 'egg'], ['sweetpotato', 'egg', 'soymilk']],
  lunch: [['chicken', 'rice', 'egg', 'kimchi'], ['beef', 'rice', 'onion', 'paprika', 'salad'], ['salmon', 'rice', 'cucumber', 'cabbage', 'avocado']],
  snack: [['greek', 'almond'], ['protein', 'tomato']],
  dinner: [['tofu', 'egg', 'rice', 'broccoli', 'greenonion'], ['chicken', 'cabbage', 'rice'], ['salmon', 'sweetpotato', 'salad', 'lemon'], ['pork', 'ssam', 'rice']],
};
Object.keys(MEAL_NEEDS).forEach((slot) => MEAL_NEEDS[slot].forEach((needs, i) => { MEALS[slot][i].needs = needs; }));

const FACE_CHECKS = [
  { id: 'water', label: '물 2.5L 마시기' },
  { id: 'nosalt', label: '국물 · 라면 · 야식 없이' },
  { id: 'sleep', label: '00:00 전에 잠들기' },
];
