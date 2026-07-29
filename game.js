
const $ = (id) => document.getElementById(id);

const RULES = [
  "이곳에서 당신은 세 번의 질문만 허락됩니다. 네 번째 질문부터는 질문이 아닌 대가로 간주됩니다.",
  "거짓말은 하지 마십시오. 우리는 거짓을 싫어합니다. 다만 진실이 반드시 도움이 되지는 않습니다.",
  "당신이 가진 것 중 가장 소중한 것을 제시하지 마십시오. 그것은 대부분 기준에 미치지 못합니다.",
  "당신이 가진 것이 아니라, 당신 자신도 소유물에 포함됩니다.",
  "기준은 변하지 않습니다. 하지만 평가자는 변할 수 있습니다.",
  "다른 손님을 발견하더라도 말을 걸지 마십시오. 그들은 대부분 아직 끝나지 않았습니다.",
  "질문은 반드시 하나씩 하십시오. 질문 안에 질문이 두 개 이상 포함되면 두 개로 계산될 수도 있습니다.",
  "“소페르”의 가치를 이해하려 하지 마십시오. 이해한 사람은 지금까지 단 한 명도 돌아오지 못했습니다.",
  "시계를 보지 마십시오. 시간은 이곳의 것이 아닙니다.",
  "원숭이 손이 손가락을 접는 모습을 보았다면 눈을 감으십시오. 몇 개를 접었는지는 기억하지 않는 것이 좋습니다.",
  "당신의 이름을 세 번 이상 말하지 마십시오. 누군가가 기억하게 됩니다.",
  "계약이 끝났다고 생각되더라도 뒤를 돌아보지 마십시오. 아직 끝난 것이 아닐 수도 있습니다."
];

const state = {
  keyword: "",
  act: 1,
  questions: 0,
  rulesRead: 0,
  clues: new Set(),
  pollution: 0,
  seenChoices: {},
  sawClock: false,
  spokeToGuest: false,
  sawFinger: false,
  nameCount: 0,
  cRestored: false,
  falseRuleFound: false,
  askedExactThree: false,
  offeredWish: false,
  items: new Set(),
  flags: new Set(),
  loopCount: 0,
  endingId: null
};

function hasFinal(word){
  const c = word.trim().slice(-1);
  const code = c.charCodeAt(0);
  return code >= 0xAC00 && code <= 0xD7A3 ? (code - 0xAC00) % 28 !== 0 : false;
}
function j(word, pair){
  const [a,b] = pair.split("/");
  return word + (hasFinal(word) ? a : b);
}
const K = (pair) => j(state.keyword, pair);

function resetState(){
  Object.assign(state,{
    keyword: state.keyword,
    act:1,questions:0,rulesRead:0,clues:new Set(),pollution:0,seenChoices:{},
    sawClock:false,spokeToGuest:false,sawFinger:false,nameCount:0,cRestored:false,
    falseRuleFound:false,askedExactThree:false,offeredWish:false,items:new Set(),
    flags:new Set(),loopCount:0,endingId:null
  });
}

function showScreen(name){
  ["startScreen","gameScreen","endingScreen"].forEach(id => $(id).classList.remove("active"));
  $(name).classList.add("active");
}

function toast(text){
  $("toast").textContent = text;
  $("toast").classList.add("show");
  setTimeout(()=>$("toast").classList.remove("show"),1600);
}

function addPollution(amount, reason=""){
  state.pollution = Math.max(0, Math.min(100, state.pollution + amount));
  if(reason) toast(reason);
  updateStatus();
}

function rememberChoice(key){
  state.seenChoices[key] = (state.seenChoices[key] || 0) + 1;
  const count = state.seenChoices[key];
  if(count === 2) addPollution(6, "같은 선택이 기록되었습니다.");
  if(count >= 3) addPollution(10, "반복 선택으로 기록이 오염됩니다.");
}

function corruptText(text){
  const p = state.pollution;
  if(p < 25) return escapeHtml(text).replaceAll("\n","<br>");
  let rate = p < 50 ? 0.04 : p < 75 ? 0.09 : 0.16;
  const chars = [...text];
  const junk = ["살려줘","도망쳐","믿지마","···","//","0x0","기록없음","누락","■■","재난관리국"];
  return chars.map((ch,i)=>{
    if(ch === "\n") return "<br>";
    if(ch === " " || /[0-9①-⑮]/.test(ch)) return ch;
    const seed = (i * 31 + p * 7 + state.questions * 13) % 100;
    if(seed < rate * 100){
      if(seed % 5 === 0) return '<span class="black-block">■</span>';
      return `<span class="micro-corruption">${escapeHtml(junk[seed % junk.length])}</span>`;
    }
    return escapeHtml(ch);
  }).join("");
}
function escapeHtml(s){
  return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}
function pollutionClass(){
  if(state.pollution >= 75) return "corrupt-3";
  if(state.pollution >= 50) return "corrupt-2";
  if(state.pollution >= 25) return "corrupt-1";
  return "";
}

function updateStatus(){
  $("actLabel").textContent = `ACT ${state.act}`;
  $("questionStat").textContent = `${state.questions} / 3`;
  $("ruleStat").textContent = `${state.rulesRead} / 12`;
  $("clueStat").textContent = `${state.clues.size} / 3`;
  $("pollutionStat").textContent = `${state.pollution}%`;
  $("pollutionBar").style.width = `${state.pollution}%`;
  $("keywordBadge").textContent = state.keyword || "미등록";
  const hint =
    state.pollution < 25 ? "공간은 아직 비교적 안정적입니다." :
    state.pollution < 50 ? "문장 일부가 기록과 다르게 보이기 시작합니다." :
    state.pollution < 75 ? "읽을 수 없는 글자가 늘고 있습니다." :
    "기록의 상당 부분이 다른 손님의 것으로 덮였습니다.";
  $("statusHint").textContent = hint;
}

function renderRules(){
  $("rulesContent").innerHTML = RULES.map((rule,i)=>{
    const unlocked = i < state.rulesRead;
    const falseMark = state.falseRuleFound && i === 4;
    return `<div class="rule-item ${unlocked?"":"locked"} ${falseMark?"false-rule":""}">
      <strong>${String(i+1).padStart(2,"0")}</strong><br>
      ${unlocked ? corruptText(rule) : "████████████████"}
    </div>`;
  }).join("") + `<div class="rule-item">※ 이 수칙 중 일부는 거짓입니다.</div>`;
}

function makeChoice(label,next,opts={}){
  return {label,next,...opts};
}

const SCENES = {
  act1:{
    act:1,code:"ROOM 00",title:"깨어난다",
    text:()=>`재난관리국 선배의 안내를 듣고 눈을 뜨자 새하얀 방으로 도달했다.

방 중앙에는 책상과 의자 하나.
책상 위에는 말라붙은 원숭이 손 하나가 놓여 있다.

그리고 처음 보는 종이.

아무도 없는데 누군가 ${K("을/를")} 기다리고 있는 것처럼 의자가 살짝 뒤로 빠져 있다.`,
    choices:()=>[
      makeChoice("종이를 읽는다.","rules",{key:"a1_rules"}),
      makeChoice("방을 둘러본다.","roomLook",{key:"a1_look"}),
      makeChoice("원숭이 손을 만진다.","touchHand",{key:"a1_hand",pollution:8}),
      makeChoice("소리친다.","shout",{key:"a1_shout",pollution:6}),
      makeChoice("눈을 다시 감는다.","closeEyes",{key:"a1_close"})
    ]
  },
  rules:{
    act:1,code:"DOCUMENT 01",title:"이용 수칙",
    text:()=>`[원숭이 손 이용 수칙]

당신은 현재 원래 세계와 단절된 공간에 있습니다.

살아 돌아가고 싶다면 아래 사항을 반드시 숙지하십시오.

해당 문건은 재난관리국에서 관리합니다. 

첫 장에는 열두 개의 항목이 적혀 있다.
마지막 문장만 다른 필체다.

“※ 이 수칙 중 일부는 거짓입니다.”`,
    onEnter:()=>{state.rulesRead = Math.max(state.rulesRead,12);},
    choices:()=>[
      makeChoice("수칙서를 접어 챙긴다.","act2",{key:"rules_take"}),
      makeChoice("5 번 수칙의 문장을 의심한다.","falseRule",{key:"rules_false"}),
      makeChoice("수칙서를 처음부터 다시 읽는다.","rules",{key:"rules_repeat",pollution:8})
    ]
  },
  falseRule:{
    act:1,code:"DOCUMENT 01-B",title:"변하지 않는 기준",
    text:()=>`“기준은 변하지 않습니다. 하지만 평가자는 변할 수 있습니다.”

문장을 오래 바라보자 “기준”이라는 단어 아래에서 지워진 글씨가 드러난다.

“기준은 평가자가 필요할 때마다 바뀝니다.”

이 항목은 거짓이다.`,
    onEnter:()=>{state.falseRuleFound = true;},
    choices:()=>[makeChoice("표시해 둔다.","act2",{key:"false_mark"})]
  },
  roomLook:{
    act:1,code:"ROOM 01",title:"방을 둘러본다",
    text:()=>`벽, 문, 천장, 시계.
전부 흰색이다.

시계에는 숫자가 없고 초침만 있다.
초침은 움직이지 않는데, ${K("이/가")} 눈을 깜빡일 때마다 위치가 바뀐다.`,
    choices:()=>[
      makeChoice("시계를 자세히 본다.","clock",{key:"look_clock",pollution:15}),
      makeChoice("책상 쪽으로 간다.","act2",{key:"look_desk"}),
      makeChoice("다시 처음처럼 방을 둘러본다.","roomLook",{key:"look_repeat",pollution:8})
    ]
  },
  touchHand:{
    act:1,code:"OBJECT 01",title:"원숭이 손",
    text:()=>`손끝이 닿는 순간 원숭이 손의 검지가 아주 조금 접힌다.

바로 뒤에서 누군가 숨을 들이마신다.

그러나 뒤에는 아무도 없다.`,
    onEnter:()=>{state.sawFinger=true;},
    choices:()=>[
      makeChoice("눈을 감는다.","act2",{key:"hand_close"}),
      makeChoice("몇 개가 접혔는지 확인한다.","fingerCount",{key:"hand_count",pollution:18})
    ]
  },
  fingerCount:{
    act:1,code:"OBJECT 01-A",title:"세지 말 것",
    text:()=>`하나.

아니, 둘.

아니.

${K("은/는")} 방금 무엇을 세고 있었는지 기억하지 못한다.

수칙서 10 번이 머릿속에서 검게 지워진다.`,
    choices:()=>[makeChoice("의자에 앉는다.","act2",{key:"finger_leave"})]
  },
  shout:{
    act:1,code:"ROOM 02",title:"반향",
    text:()=>`${K("이/가")} 소리친다.

대답 대신 같은 목소리가 천장에서 돌아온다.

“${state.keyword}.”
“${state.keyword}.”
“${state.keyword}.”

세 번째 목소리는 ${K("의/의")} 것이 아니다.`,
    onEnter:()=>{state.nameCount += 3;},
    choices:()=>[makeChoice("의자에 앉는다.","act2",{key:"shout_sit",pollution:10})]
  },
  closeEyes:{
    act:1,code:"ROOM 03",title:"다시 감은 눈",
    text:()=>`눈을 감자 방이 사라진다.

대신 아주 가까운 곳에서 종이를 넘기는 소리가 들린다.

“이번 손님은 질문을 아끼는군요.”

눈을 뜨면 의자 맞은편에 형체를 알 수 없는 누군가 앉아 있다.`,
    choices:()=>[makeChoice("상대를 바라본다.","act2",{key:"close_open"})]
  },
  act2:{
    act:2,code:"INTERVIEW 01",title:"첫 번째 질문",
    speaker:"평가자",
    text:()=>`흰 장갑을 낀 원숭이가 맞은편에 앉아 있다.

“환영합니다, ${state.keyword}.”

“당신은 저에게 딱 세 번까지 질문할 수 있습니다.”

“그 뒤에는 당신이 가진 것 중 하나를 제출하십시오.”`,
    choices:()=>[
      makeChoice("여기는 어디지?","a2_where",{key:"q_where",question:true}),
      makeChoice("왜 나를 선택했어?","a2_why",{key:"q_why",question:true}),
      makeChoice("기준이 뭐야?","a2_standard",{key:"q_standard",question:true}),
      makeChoice("소페르가 뭐야?","a2_sopher",{key:"q_sopher",question:true,pollution:6}),
      makeChoice("질문하지 않고 관찰한다.","act3",{key:"q_observe"})
    ]
  },
  a2_where:{act:2,code:"ANSWER 01",title:"여기",
    speaker:"평가자",text:()=>`“원래 세계와 단절된 평가실입니다. 당신들이 괴담이라 부르는 곳이기도 하죠.”

“당신이 돌아갈 수 있는지는 아직 결정되지 않았습니다.”`,
    choices:()=>[makeChoice("주변을 조사한다.","act3",{key:"a2_where_next"})]},
  a2_why:{act:2,code:"ANSWER 02",title:"선정",
    speaker:"평가자",text:()=>`“선정 기준은 공개하지 않습니다. 뭐, 추후에 요원이 되어 돌아온다면 몰라도요.”

“다만 ${K("은/는")} 오래전부터 기다리던 유형입니다.”`,
    choices:()=>[makeChoice("주변을 조사한다.","act3",{key:"a2_why_next"})]},
  a2_standard:{act:2,code:"ANSWER 03",title:"기준",
    speaker:"평가자",text:()=>`“기준은 160 소페르입니다.”

“그 이하의 가치는 전부 부족합니다.”

그의 입꼬리가 아주 잠깐 올라간다.`,
    choices:()=>[makeChoice("주변을 조사한다.","act3",{key:"a2_std_next"})]},
  a2_sopher:{act:2,code:"ANSWER 04",title:"소페르",
    speaker:"평가자",text:()=>`“이해하려 하지 마십시오.”

“이해한 사람은 돌아가지 못했습니다.”

원숭이 손의 약지가 접힌다.`,
    onEnter:()=>{state.sawFinger=true;},
    choices:()=>[makeChoice("주변을 조사한다.","act3",{key:"a2_sopher_next"})]},
  act3:{
    act:3,code:"SEARCH",title:"주변 조사",
    text:()=>`평가자는 조사를 허락한다.

“무엇을 찾든 질문으로 계산하지 않겠습니다.”

그 말이 진실인지는 알 수 없다.`,
    choices:()=>[
      makeChoice("벽을 조사한다.","wall",{key:"s_wall"}),
      makeChoice("책상을 조사한다.","desk",{key:"s_desk"}),
      makeChoice("시계를 조사한다.","clock",{key:"s_clock",pollution:15}),
      makeChoice("천장을 조사한다.","ceiling",{key:"s_ceiling"}),
      makeChoice("문을 조사한다.","door",{key:"s_door"}),
      makeChoice("의자를 조사한다.","chair",{key:"s_chair"}),
      makeChoice("피 묻은 계약서를 조사한다.","contract",{key:"s_contract"})
    ]
  },
  wall:{act:3,code:"TRACE A",title:"A 손님의 기록",
    text:()=>`벽 안쪽에서 얇은 종이가 나온다.

“나는 가장 비싼 시계를 지불했다.”
“그는 웃었다.”
“그는 자신이 필요한 것은 그 안에 있다고 했다.”

끝까지 읽자 작은 모래시계가 떨어진다.`,
    onEnter:()=>{state.clues.add("A");state.items.add("모래시계");},
    choices:()=>[makeChoice("조사를 계속한다.","act3",{key:"wall_back"}),makeChoice("두 번째 질문으로 넘어간다.","act4",{key:"wall_act4"})]},
  desk:{act:3,code:"TRACE B",title:"B 손님의 기록",
    text:()=>`책상 밑면에 긁힌 글씨.

“왼손.”
“분명 왼손이라고 말했다.”
“그런데 그는 왼쪽의 손과 목을 가져갔다.”

마지막 줄 아래에 “왼손”이라는 단어가 반복되어 있다.`,
    onEnter:()=>{state.clues.add("B");state.items.add("왼손");},
    choices:()=>[makeChoice("조사를 계속한다.","act3",{key:"desk_back"}),makeChoice("두 번째 질문으로 넘어간다.","act4",{key:"desk_act4"})]},
  clock:{act:3,code:"RULE VIOLATION",title:"시계",
    text:()=>`초침이 ${K("을/를")} 가리킨다.

원숭이 손의 손가락 하나가 접힌다.

그 순간 방 전체의 문장이 한 글자씩 어긋난다.`,
    onEnter:()=>{state.sawClock=true;state.sawFinger=true;addPollution(12);},
    choices:()=>[makeChoice("조사를 계속한다.","act3",{key:"clock_back"}),makeChoice("두 번째 질문으로 넘어간다.","act4",{key:"clock_act4"})]},
  ceiling:{act:3,code:"TRACE C-1",title:"C 손님의 기록",
    text:()=>`천장 모서리에 거꾸로 적힌 문장.

“기준은 변하지 않는다.”
“아니, 평가자가 바뀌면 기준도.......”
“160은 물건의 가격이 아니라.......”

기록은 여기서 끊겨 있다.`,
    onEnter:()=>{state.clues.add("C");},
    choices:()=>[makeChoice("다른 흔적을 찾아 복원한다.","contract",{key:"c_restore"}),makeChoice("조사를 계속한다.","act3",{key:"ceiling_back"})]},
  door:{act:3,code:"EXIT 00",title:"문",
    text:()=>`손잡이가 없다.

문 아래 틈으로 그림자 하나가 지나간다.

“저, 저기요. 요원 맞으시죠. 제발요. 제가 재난관리국을 이쪽으로 부른 거예요. 제발 저 좀 도와주세요.”

다른 손님의 목소리다.`,
    choices:()=>[
      makeChoice("말을 건다.","guestTalk",{key:"door_talk",pollution:18}),
      makeChoice("대답하지 않는다.","act3",{key:"door_silent"}),
      makeChoice("두 번째 질문으로 넘어간다.","act4",{key:"door_act4"})
    ]},
  guestTalk:{act:3,code:"RULE VIOLATION",title:"끝나지 않은 손님",
    text:()=>`${K("이/가")} “누구세요?”라고 묻는다.

문 아래 그림자가 멈춘다.

천천히 고개를 내려 문틈으로 난 발치를 마주하나 아무것도 없다. 

오직 하얀 방만이 보인다.

아니, 아니다.

그것은 그저 눈, 코, 입이 없는 누군가의 얼굴이었다.

그 순간 이 방과도 같은 하얀 민낯이 ${K("의/의")} 얼굴과 같아진다.`,
    onEnter:()=>{state.spokeToGuest=true;},
    choices:()=>[makeChoice("뒤로 물러난다.","act4",{key:"guest_leave"})]},
  chair:{act:3,code:"OBJECT 04",title:"의자",
    text:()=>`의자 아래에는 손톱 두 개와 짧은 머리카락이 붙어 있다.

누군가 이곳에서 오래 버틴 흔적이다.

등받이 안쪽에는 “질문하지 말 것”이라고 적혀 있다.`,
    choices:()=>[makeChoice("조사를 계속한다.","act3",{key:"chair_back"}),makeChoice("두 번째 질문으로 넘어간다.","act4",{key:"chair_act4"})]},
  contract:{act:3,code:"TRACE C-2",title:"피 묻은 계약서",
    text:()=>`계약서 뒷면에 C의 기록이 이어진다.

“160 소페르는 포기할 수 없는 것의 무게.”
“그가 정한 기준이 아니라 내가 포기하지 못한 정도.”
“마지막 대가는 소유물이 아니라 소원이어야.......”

마지막 단어는 피로 번져 있지만 복원할 수 있다.`,
    onEnter:()=>{if(state.clues.has("C")) state.cRestored=true;},
    choices:()=>[makeChoice("‘소원’이라고 복원한다.","act4",{key:"c_wish"}),makeChoice("‘목숨’이라고 복원한다.","act4",{key:"c_life",pollution:8})]},
  act4:{
    act:4,code:"INTERVIEW 02",title:"두 번째 질문",
    speaker:"평가자",
    text:()=>`평가자가 손가락으로 책상을 두드린다.

“두 번째 질문입니다.”

“혹은 두 번째라고 믿고 있는 질문이지요.”`,
    choices:()=>[
      makeChoice("소페르가 무엇인가?","a4_sopher",{key:"q2_sopher",question:true}),
      makeChoice("대가는 어떻게 정하는가?","a4_price",{key:"q2_price",question:true}),
      makeChoice("이전 사람들은 어떻게 됐나?","a4_guests",{key:"q2_guests",question:true}),
      makeChoice("기준은 항상 같은가?","a4_change",{key:"q2_change",question:true}),
      makeChoice("질문을 아낀다.","act5",{key:"q2_save"})
    ]},
  a4_sopher:{act:4,code:"ANSWER 05",title:"단위",
    speaker:"평가자",text:()=>`“소페르는 비교를 위한 이름일 뿐입니다. 인간의 가치로는 알 수 없죠.”

“정확한 뜻을 아는 순간 당신은 평가 대상에서 제외됩니다.”`,
    choices:()=>[makeChoice("숨겨진 검사를 기다린다.","act5",{key:"a4s_next"})]},
  a4_price:{act:4,code:"ANSWER 06",title:"대가",
    speaker:"평가자",text:()=>`“당신이 내놓을 때의 망설임으로 정합니다.”

“비싼 물건은 대부분 가볍습니다.”`,
    choices:()=>[makeChoice("숨겨진 검사를 기다린다.","act5",{key:"a4p_next"})]},
  a4_guests:{act:4,code:"ANSWER 07",title:"이전 손님",
    speaker:"평가자",text:()=>`“A는 시침을 냈고, B는 문장을 잘못 골랐습니다.”

“C는 거의 이해했습니다.”

“거의라는 말은 살아남았다는 뜻이 아닙니다.”`,
    choices:()=>[makeChoice("숨겨진 검사를 기다린다.","act5",{key:"a4g_next"})]},
  a4_change:{act:4,code:"ANSWER 08",title:"변하는 기준",
    speaker:"평가자",text:()=>`“기준은 변하지 않습니다.”

그 순간 수칙서 5번의 글씨가 뒤집힌다.

평가자의 대답은 거짓이다.`,
    onEnter:()=>{state.falseRuleFound=true;},
    choices:()=>[makeChoice("숨겨진 검사를 기다린다.","act5",{key:"a4c_next"})]},
  act5:{
    act:5,code:"AUDIT",title:"숨겨진 검사",
    text:()=>`불이 한 번 꺼졌다 환해진다.

평가자는 ${K("의/의")} 위반 기록을 읽는다.

${()=>""}`,
    dynamicText:()=> {
      const lines = [];
      if(state.sawClock) lines.push("시계를 본 기록이 있습니다.");
      if(state.spokeToGuest) lines.push("끝나지 않은 손님에게 말을 건 기록이 있습니다.");
      if(state.nameCount >= 3) lines.push("키워드를 세 번 이상 말한 기록이 있습니다.");
      if(state.pollution >= 40) lines.push("기록의 상당 부분이 반복 선택으로 오염되었습니다.");
      if(!lines.length) lines.push("확인된 위반 사항이 없습니다.");
      return `불이 한 번 꺼졌다 켜진다.\n\n평가자는 ${K("의/의")} 위반 기록을 읽는다.\n\n${lines.join("\n")}`;
    },
    choices:()=>[
      makeChoice("위반 사실을 인정한다.","act6",{key:"audit_accept"}),
      makeChoice("기록이 잘못됐다고 거짓말한다.","act6",{key:"audit_lie",pollution:18}),
      makeChoice("같은 검사를 다시 요구한다.","act5",{key:"audit_repeat",pollution:12})
    ]},
  act6:{
    act:6,code:"INTERVIEW 03",title:"세 번째 질문",
    speaker:"평가자",
    text:()=>`“마지막 질문입니다.”

“대답을 들은 뒤에는 대가를 고르십시오.”

원숭이 손이 천천히 책상 중앙으로 움직인다.`,
    choices:()=>[
      makeChoice("내 몸도 가능한가?","a6_body",{key:"q3_body",question:true}),
      makeChoice("기억도 가능한가?","a6_memory",{key:"q3_memory",question:true}),
      makeChoice("미래를 줄 수 있나?","a6_future",{key:"q3_future",question:true}),
      makeChoice("사랑하는 사람은 가능한가?","a6_love",{key:"q3_love",question:true}),
      makeChoice("질문하지 않는다.","act7",{key:"q3_none"})
    ]},
  a6_body:{act:6,code:"ANSWER 09",title:"몸",
    speaker:"평가자",text:()=>`“가능합니다.”

“당신 자신도 당신의 소유물입니다.”`,
    choices:()=>[makeChoice("대가를 고른다.","act7",{key:"a6b_next"})]},
  a6_memory:{act:6,code:"ANSWER 10",title:"기억",
    speaker:"평가자",text:()=>`“가능합니다.”

“기억을 모두 잃어도 생존으로 인정됩니다.”`,
    choices:()=>[makeChoice("대가를 고른다.","act7",{key:"a6m_next"})]},
  a6_future:{act:6,code:"ANSWER 11",title:"미래",
    speaker:"평가자",text:()=>`“가능합니다.”

“다만 아직 소유하지 않은 것을 내놓는 데에는 이자가 붙습니다.”`,
    choices:()=>[makeChoice("대가를 고른다.","act7",{key:"a6f_next"})]},
  a6_love:{act:6,code:"ANSWER 12",title:"사랑하는 사람",
    speaker:"평가자",text:()=>`“당신이 그 사람을 소유한다고 믿는다면 가능합니다.”

평가자의 미소가 처음으로 불쾌해진다.`,
    choices:()=>[makeChoice("대가를 고른다.","act7",{key:"a6l_next"})]},
  act7:{
    act:7,code:"OFFER",title:"대가 선택",
    text:()=>`평가자가 빈 계약서를 밀어 준다.

“160 소페르 이상이어야 합니다.”

“한번 선택하면 수정할 수 없습니다.”

질문 수: ${state.questions}
오염도: ${state.pollution}%`,
    onEnter:()=>{state.askedExactThree = state.questions === 3;},
    choices:()=>offerChoices()
  }
};

function offerChoices(){
  const base = [
    ["명품 시계","end1"],["결혼반지","end4"],["스마트폰","end4"],["전재산","end4"],
    ["왼손","end2"],["오른팔","end4"],["목소리","end4"],["이름","end3"],
    ["기억","end5"],["수명 10년","end4"],["행복했던 하루","end5"],["부모님에 대한 기억","end5"],
    ["미래","end4"],["자신의 그림자","end4"],["자신의 존재","end3"]
  ].map(([label,end],i)=>makeChoice(label,end,{key:`offer_${i}`}));

  if(state.spokeToGuest) base.push(makeChoice("문 너머의 다른 손님","end6",{key:"offer_guest"}));
  if(state.cRestored) base.push(makeChoice("자신의 소원","trueEnd",{key:"offer_wish"}));
  if(state.loopCount >= 9) base.push(makeChoice("평가자의 다음 손님","hiddenEnd",{key:"offer_hidden"}));
  return base;
}

const ENDINGS = {
  end1:{
    code:"END 1",title:"모래시계",
    text:()=>`${K("은/는")} 당신은 재난관리국에서 지급한 명품 시계를 내놓았다.

평가자는 시계의 가격표를 확인하지 않았다.

“시침이 제대로 들어 있군요.”

그 순간 시계 안의 시간이 빠져나오고 시계에 숫자가 지워진다.

동시에 ${K("은/는")} A의 기록처럼 모래시계 안쪽에 갇힌다.`,
    summary:()=>`${K("은/는")} 시계가 아니라 시간 속 자신을 제출했습니다.`
  },
  end2:{
    code:"END 2",title:"축하합니다",
    text:()=>`${K("은/는")} “왼손”을 대가로 적었다.

평가자는 만족스럽게 고개를 끄덕인다.

현실로 돌아온 뒤 ${K("은/는")} 왼쪽 손과 목이 사라졌다는 것을 알게 된다. 이는 영원히 치유되지 않을 것이다. 

계약서는 문장을 정확히 지켰다.`,
    summary:()=>`${K("은/는")} 왼쪽의 손과 목을 잃고 현실로 돌아왔습니다.`
  },
  end3:{
    code:"END 3",title:"평가자",
    text:()=>`${K("은/는")} 이름 혹은 존재를 내놓았다.

평가자는 처음으로 자리에서 일어난다.

“이제 손님을 받을 사람이 필요하겠군요.”

흰 장갑이 ${K("의/의")} 손에 맞게 줄어든다.

문은 영원히 열리지 않는다. 당신은 돌아갈 수 없다.`,
    summary:()=>`${K("은/는")} 원숭이 손의 새로운 평가자가 되었습니다.`
  },
  end4:{
    code:"END 4",title:"불합리",
    text:()=>`계약서의 수치가 160 소페르를 넘는다.

평가자는 한동안 계약서를 바라본다.

그리고 종이를 찢는다.

“충분합니다.”

“하지만 오늘은 기분이 별로네요.”

불이 꺼지고 ${K("은/는")} 다시 처음의 의자에서 깨어난다.`,
    summary:()=>`충분한 대가였지만 평가자는 ${K("을/를")} 돌려보내지 않았습니다.`
  },
  end5:{
    code:"END 5",title:"기억",
    text:()=>`${K("은/는")} 기억을 대가로 제출한다.

문은 열린다.

현실의 누군가가 울면서 ${K("을/를")} 끌어안는다.

하지만 ${K("은/는")} 그 사람이 누구인지, 자신이 왜 돌아왔는지 알 수 없다.`,
    summary:()=>`${K("은/는")} 살아남았지만 자신이 누구인지 기억하지 못합니다.`
  },
  end6:{
    code:"END 6",title:"교환",
    text:()=>`${K("은/는")} 문 너머의 다른 손님을 대신 제출한다.

문이 열리고 현실로 돌아온다.

하지만 거울을 볼 때마다 얼굴이 잠깐씩 다른 사람의 것으로 바뀐다.

그 사람은 거울 안에서 계속 입을 움직인다.

“당신은 재난관리국에 있을 수 없어.”`,
    summary:()=>`${K("은/는")} 다른 손님과 자리를 바꾸어 탈출했습니다.`
  },
  trueEnd:{
    code:"TRUE END",title:"160 소페르",
    text:()=>`시계를 보지 않았다.
질문은 정확히 세 번이었다.
C의 기록은 끝까지 복원되었다.
거짓 수칙도 찾아냈다.

${K("은/는")} 마지막 대가로 “자신의 소원”을 적는다.

원숭이는 처음으로 웃는다.

“드디어 이해했군요.”

“160 소페르는 물건의 가치가 아닙니다.”

“당신이 포기할 수 없는 것의 무게를 뜻하지요.”

문이 열린다.

${K("은/는")} 아무것도 잃지 않은 채 현실로 돌아온다.

집에 돌아와 문을 닫는 순간, 주머니에서 종이 한 장이 떨어진다.

[기다리던 첫 손님, 10월에 뵙겠습니다]

그 아래에는 ${K("의/의")} 키워드와 오늘 날짜가 적혀 있다.`,
    summary:()=>`${K("은/는")} 160 소페르의 의미를 이해하고 돌아왔습니다.`
  },
  hiddenEnd:{
    code:"HIDDEN END",title:"열 번째 손님",
    text:()=>`${K("은/는")} 같은 선택을 열 번 반복했다.

책상 아래의 공간이 흰 방보다 깊어진다.

그곳에는 똑같은 방이 아홉 개 더 있다.

각 방의 의자에는 같은 키워드를 가진 사람이 앉아 있다.

열 번째 방에서 누군가 고개를 든다.

“이번에는 네가 위에서 기다릴 차례야.”

${K("의/의")} 손이 책상 위로 올라간다.`,
    summary:()=>`새로운 기록자 ${K("이/가")} 열 번째 손님으로 등록되었습니다.`
  }
};

function evaluateTrueEnd(){
  return !state.sawClock &&
    state.questions === 3 &&
    state.cRestored &&
    state.falseRuleFound &&
    state.pollution < 55;
}

function renderScene(id){
  const scene = SCENES[id];
  if(!scene) return;

  state.act = scene.act;
  if(scene.onEnter) scene.onEnter();

  $("sceneCode").textContent = scene.code;
  $("sceneTitle").textContent = scene.title;
  $("speaker").textContent = scene.speaker || "";
  $("speaker").classList.toggle("hidden",!scene.speaker);

  const raw = scene.dynamicText ? scene.dynamicText() : scene.text();
  $("sceneText").className = `story-text ${pollutionClass()}`;
  $("sceneText").innerHTML = corruptText(raw);

  $("choiceList").innerHTML = "";
  const choices = scene.choices();
  choices.forEach((choice,index)=>{
    const btn = document.createElement("button");
    btn.className = "choice-button";
    btn.type = "button";
    btn.innerHTML = corruptText(choice.label);
    btn.addEventListener("click",()=>{
      rememberChoice(choice.key || `${id}_${index}`);
      if(choice.pollution) addPollution(choice.pollution);
      if(choice.question){
        state.questions += 1;
        if(state.questions > 3) addPollution(20,"네 번째 질문이 대가로 기록되었습니다.");
      }

      if(id === "act5" && choice.key === "audit_lie") addPollution(8,"거짓말이 기록되었습니다.");
      if(id === "act7" && choice.next === "trueEnd"){
        state.offeredWish = true;
        if(!evaluateTrueEnd()) return showEnding("end4");
      }

      if(choice.next === "act5" && choice.key === "audit_repeat"){
        state.loopCount++;
      }
      if(choice.next === "act1" || choice.next === "rules" || choice.next === "roomLook"){
        state.loopCount++;
      }

      if(ENDINGS[choice.next]) showEnding(choice.next);
      else renderScene(choice.next);
      updateStatus();
    });
    $("choiceList").appendChild(btn);
  });

  updateStatus();
}

function showEnding(id){
  const end = ENDINGS[id];
  state.endingId = id;
  $("endingCode").textContent = end.code;
  $("endingTitle").textContent = end.title;
  $("endingText").className = `ending-text ${pollutionClass()}`;
  $("endingText").innerHTML = corruptText(end.text());
  $("endingKeyword").textContent = state.keyword;
  $("endingSummary").textContent = end.summary();

  const failures = JSON.parse(localStorage.getItem("monkeyHandFailures") || "{}");
  if(id !== "trueEnd" && id !== "hiddenEnd"){
    failures[id] = (failures[id] || 0) + 1;
    localStorage.setItem("monkeyHandFailures",JSON.stringify(failures));
  }

  showScreen("endingScreen");
}

function saveResult(){
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#fbfbf8";
  ctx.fillRect(0,0,1080,1350);
  ctx.strokeStyle = "#d7d7d1";
  ctx.lineWidth = 2;
  ctx.strokeRect(70,70,940,1210);

  ctx.textAlign = "center";
  ctx.fillStyle = "#777771";
  ctx.font = "28px sans-serif";
  ctx.fillText($("endingCode").textContent,540,210);

  ctx.fillStyle = "#171717";
  ctx.font = "68px serif";
  ctx.fillText($("endingTitle").textContent,540,340);

  ctx.font = "90px serif";
  ctx.fillText(state.keyword,540,650);

  ctx.fillStyle = "#333";
  ctx.font = "34px sans-serif";
  wrapCanvas(ctx,$("endingSummary").textContent,540,820,760,56);

  ctx.fillStyle = "#777771";
  ctx.font = "24px sans-serif";
  ctx.fillText(`오염도 ${state.pollution}% · 질문 ${state.questions}회`,540,1080);
  ctx.fillText("원숭이 손 / WHITE ROOM RECORD",540,1180);

  const link = document.createElement("a");
  link.download = `원숭이손_${state.keyword}_${$("endingTitle").textContent}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  toast("결과 이미지를 저장했습니다.");
}

function wrapCanvas(ctx,text,x,y,maxWidth,lineHeight){
  const words = text.split(" ");
  let line = "";
  const lines = [];
  for(const word of words){
    const test = line ? `${line} ${word}` : word;
    if(ctx.measureText(test).width > maxWidth && line){
      lines.push(line);
      line = word;
    }else line = test;
  }
  if(line) lines.push(line);
  lines.forEach((item,i)=>ctx.fillText(item,x,y+i*lineHeight));
}

$("startButton").addEventListener("click",()=>{
  const value = $("keywordInput").value.trim();
  if(!value) return toast("키워드를 입력해 주세요.");
  state.keyword = value;
  resetState();
  showScreen("gameScreen");
  renderScene("act1");
});
$("keywordInput").addEventListener("keydown",e=>{
  if(e.key === "Enter") $("startButton").click();
});
$("rulesButton").addEventListener("click",()=>{
  renderRules();
  $("rulesDialog").showModal();
});
$("resetButton").addEventListener("click",()=>location.reload());
$("restartButton").addEventListener("click",()=>location.reload());
$("saveResultButton").addEventListener("click",saveResult);

updateStatus();

/* ===== COMPLETE EDITION ENHANCEMENTS ===== */
state.deskDepth = 0;
state.sceneVisits = {};
state.theme = localStorage.getItem("monkeyHandTheme") || "light";

const ORIGINAL_RESET = resetState;
resetState = function(){
  ORIGINAL_RESET();
  state.deskDepth = 0;
  state.sceneVisits = {};
};

const DESK_LINES = [
  "책상 아래에는 먼지만 있다.",
  "먼지 사이에 손톱으로 긁은 선이 하나 있다.",
  "선은 글자다. ‘보지 마.’라고 적혀 있다.",
  "누군가 방금까지 웅크리고 있던 온기가 남아 있다.",
  "가장 안쪽에서 손가락 네 개가 천천히 사라진다.",
  "아무것도 없다. 방금 본 손도, 글자도 없다.",
  "책상 아래는 책상의 깊이보다 더 깊다.",
  "아래쪽에서 같은 목소리가 말한다. ‘여기에는 위가 없어.’",
  "누군가 정확히 세 번 당신의 키워드를 부른다.",
  "책상 아래에서 고개를 든다. 처음부터 이쪽에 있던 것은 당신이었다."
];

SCENES.underDesk = {
  act:3,code:"TRACE D",title:"책상 아래",
  dynamicText:()=>{
    const n = Math.max(1,state.deskDepth);
    const history = DESK_LINES.slice(0,n).join("\n\n");
    if(n < 10) return `${history}\n\n조사 기록 ${n} / 10`;
    return `${history}\n\n선택지는 오래전부터 하나뿐이었다.`;
  },
  choices:()=>{
    if(state.deskDepth >= 10){
      return [
        makeChoice("책상 아래를 본다.","hiddenEnd",{key:"desk_final_1"}),
        makeChoice("책상 아래를 본다.","hiddenEnd",{key:"desk_final_2"}),
        makeChoice("책상 아래를 본다.","hiddenEnd",{key:"desk_final_3"})
      ];
    }
    return [
      makeChoice("조금 더 안쪽을 본다.","underDesk",{key:"under_desk_repeat",pollution:state.deskDepth < 4 ? 2 : 5}),
      makeChoice("조사를 중단한다.","act3",{key:"under_desk_leave"}),
      makeChoice("두 번째 질문으로 넘어간다.","act4",{key:"under_desk_act4"})
    ];
  }
};

const originalDeskChoices = SCENES.desk.choices;
SCENES.desk.choices = ()=>[
  makeChoice("책상 아래를 조사한다.","underDesk",{key:"desk_under"}),
  ...originalDeskChoices()
];

const originalRenderScene = renderScene;
renderScene = function(id){
  state.sceneVisits[id] = (state.sceneVisits[id] || 0) + 1;
  if(id === "underDesk"){
    state.deskDepth = Math.min(10,state.deskDepth + 1);
    state.loopCount = state.deskDepth;
    if(state.deskDepth === 5) addPollution(5,"책상 아래에서 기록되지 않은 손님이 감지되었습니다.");
    if(state.deskDepth === 9){ state.nameCount += 3; addPollution(12,"누군가 키워드를 기억했습니다."); }
    if(state.deskDepth === 10) addPollution(18,"선택권이 회수되었습니다.");
  }
  originalRenderScene(id);
  applyPollutionEffects();
  animateStoryEntry();
  if(id === "underDesk" && state.deskDepth >= 10){
    document.querySelectorAll(".choice-button").forEach(b=>b.classList.add("forced"));
  }
};

const originalUpdateStatus = updateStatus;
updateStatus = function(){
  originalUpdateStatus();
  applyPollutionEffects();
};

function animateStoryEntry(){
  const card = $("storyCard");
  if(!card) return;
  card.animate([{opacity:.15,transform:"translateY(8px)"},{opacity:1,transform:"translateY(0)"}],{duration:380,easing:"ease-out"});
  if(state.pollution >= 65 && Math.random() < .42){
    $("flash").classList.remove("flash-on");
    void $("flash").offsetWidth;
    $("flash").classList.add("flash-on");
  }
}

const WARNINGS = [
  "살려 줘.","도망쳐.","재난관리국을 믿지 마.","질문하지 마.","뒤를 보지 마.",
  "160", "그는 사람이 아니다.","문은 열리지 않는다.","네 번째 질문", "여기서 나가게 해 줘."
];
function seeded(n){ return Math.abs(Math.sin(n*999)*10000)%1; }
function buildWarningFlood(){
  const root = $("warningFlood");
  if(!root) return;
  const count = state.pollution < 45 ? 0 : state.pollution < 65 ? 6 : state.pollution < 82 ? 18 : 42;
  root.innerHTML = Array.from({length:count},(_,i)=>{
    const text = WARNINGS[(i + state.pollution + state.questions) % WARNINGS.length];
    const left = Math.floor(seeded(i+state.pollution)*90);
    const top = Math.floor(seeded(i*3+state.pollution)*92);
    const size = 12 + Math.floor(seeded(i*7)*34);
    const rot = -15 + Math.floor(seeded(i*11)*30);
    return `<span class="warning-fragment" style="left:${left}%;top:${top}%;font-size:${size}px;transform:rotate(${rot}deg)">${escapeHtml(text)}</span>`;
  }).join("");
}
function applyPollutionEffects(){
  document.body.classList.toggle("pollution-mid",state.pollution>=25);
  document.body.classList.toggle("pollution-high",state.pollution>=55);
  document.body.classList.toggle("pollution-critical",state.pollution>=82);
  buildWarningFlood();
  if(state.pollution >= 88){
    document.querySelectorAll(".choice-button").forEach((btn,i)=>{
      if(i % 3 === 1 && state.deskDepth < 10) btn.style.pointerEvents = "none";
    });
  }
}

function applyTheme(theme){
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("monkeyHandTheme",theme);
  $("themeButton").textContent = theme === "light" ? "◐" : "◑";
}
applyTheme(state.theme);
$("themeButton").addEventListener("click",()=>applyTheme(state.theme === "light" ? "dark" : "light"));

const ENDING_NAMES = {
  end1:"모래시계",end2:"축하합니다",end3:"평가자",end4:"불합리",end5:"기억",end6:"교환",trueEnd:"160 소페르",hiddenEnd:"열 번째 손님"
};
const originalShowEnding = showEnding;
showEnding = function(id){
  originalShowEnding(id);
  const found = JSON.parse(localStorage.getItem("monkeyHandEndings") || "[]");
  if(!found.includes(id)){ found.push(id); localStorage.setItem("monkeyHandEndings",JSON.stringify(found)); }
  applyPollutionEffects();
};
function renderCollection(){
  const found = JSON.parse(localStorage.getItem("monkeyHandEndings") || "[]");
  $("collectionContent").innerHTML = Object.entries(ENDING_NAMES).map(([id,name])=>{
    const open = found.includes(id);
    return `<div class="collection-item ${open?"":"locked"}"><strong>${open?name:"미확인 기록"}</strong><p>${open?id:"████████"}</p></div>`;
  }).join("");
}
$("collectionButton").addEventListener("click",()=>{renderCollection();$("collectionDialog").showModal();});

/* Override hidden offer: hidden ending is reached only through the desk loop. */
const originalOfferChoices = offerChoices;
offerChoices = function(){
  return originalOfferChoices().filter(choice=>choice.next !== "hiddenEnd");
};


/* ===== LIVING CONTAMINATION SWARM + ETHICS RECOVERY ===== */
const RECOVERY_ANSWER = "앞선 자들은 다가올 길을 열고 뒤따르는 자들은 먼저 간 이들을 짊어진 채 우리는 끊임없이 전진한다";
const SWARM_LINES = [
  "제발 살려 줘.","살려 줘.","도망쳐.","재난관리국을 믿지 마.",
  "재난관리국을 믿지 마.","재난관리국을 믿지 마.","뒤를 보지 마.",
  "나는 아직 여기 있다.","질문하지 마.","이 기록은 네 것이 아니다.",
  "문을 열지 마.","그들이 먼저 왔다.","우리를 두고 가지 마.",
  "160 160 160", "찾지 마.", "제발", "나가게 해 줘.", "보고 있다."
];
let swarmTimer = null;
let criticalSince = 0;
let recoveryShownThisRun = false;
let currentSceneId = "act1";

const priorRenderSceneForRecovery = renderScene;
renderScene = function(id){
  currentSceneId = id;
  priorRenderSceneForRecovery(id);
};

function swarmInterval(){
  if(state.pollution < 42) return 0;
  if(state.pollution < 60) return 520;
  if(state.pollution < 75) return 210;
  if(state.pollution < 88) return 72;
  return 24;
}

function spawnSwarmFragment(forceText=""){
  const root = $("warningFlood");
  if(!root || state.pollution < 42) return;
  const span = document.createElement("span");
  const text = forceText || SWARM_LINES[Math.floor(Math.random()*SWARM_LINES.length)];
  const x = Math.random()*96;
  const y = Math.random()*96;
  const r = -9 + Math.random()*18;
  span.className = "warning-fragment swarm-new";
  if(Math.random() < .38) span.classList.add("swarm-dense");
  if(Math.random() < .24) span.classList.add("swarm-whisper");
  span.textContent = text;
  span.style.left = `${x}%`;
  span.style.top = `${y}%`;
  span.style.setProperty("--r",`${r}deg`);
  span.style.zIndex = String(Math.floor(Math.random()*4));
  root.appendChild(span);

  const cap = state.pollution >= 88 ? 720 : state.pollution >= 75 ? 430 : 180;
  while(root.childElementCount > cap) root.removeChild(root.firstElementChild);
}

function swarmBurst(amount,text=""){
  for(let i=0;i<amount;i++) setTimeout(()=>spawnSwarmFragment(text),i*8);
}

function syncSwarmEngine(){
  const interval = swarmInterval();
  if(swarmTimer){ clearInterval(swarmTimer); swarmTimer=null; }
  if(interval){
    swarmTimer=setInterval(()=>{
      const burst = state.pollution >= 88 ? 4 : state.pollution >= 75 ? 2 : 1;
      for(let i=0;i<burst;i++) spawnSwarmFragment();
      if(state.pollution >= 82 && Math.random()<.18) swarmBurst(18,"재난관리국을 믿지 마.");
      if(state.pollution >= 88 && Math.random()<.22) swarmBurst(24,"제발 살려 줘.");
      checkRecoveryTransmission();
    },interval);
  }
  if(state.pollution < 82) criticalSince=0;
}

function checkRecoveryTransmission(){
  if(state.pollution < 82 || recoveryShownThisRun) return;
  if(!criticalSince) criticalSince=Date.now();
  if(Date.now()-criticalSince < 6500) return;
  recoveryShownThisRun=true;
  swarmBurst(90);
  setTimeout(openRecoveryTransmission,500);
}

function openRecoveryTransmission(){
  const dialog=$("recoveryDialog");
  if(!dialog || dialog.open) return;
  $("recoveryInput").value="";
  $("recoveryFeedback").textContent="";
  $("recoveryFeedback").className="recovery-feedback";
  document.body.classList.add("recovery-open");
  dialog.showModal();
  setTimeout(()=>$("recoveryInput").focus(),60);
}

function submitRecoveryAnswer(){
  const value=$("recoveryInput").value.trim().replace(/\s+/g," ");
  const feedback=$("recoveryFeedback");
  if(value === RECOVERY_ANSWER){
    state.pollution=0;
    criticalSince=0;
    const root=$("warningFlood");
    if(root) root.innerHTML="";
    document.body.classList.remove("recovery-open","pollution-mid","pollution-high","pollution-critical");
    $("recoveryDialog").close();
    syncSwarmEngine();
    updateStatus();
    if(SCENES[currentSceneId]) priorRenderSceneForRecovery(currentSceneId);
    toast("요원 식별 완료. 기록 오염도가 0%로 복구되었습니다.");
    return;
  }
  feedback.textContent="응답 불일치. 윤리 규범 다섯 번째 항목을 다시 기억하십시오.";
  feedback.className="recovery-feedback wrong";
  addPollution(5);
  swarmBurst(75,"재난관리국을 믿지 마.");
  $("recoveryInput").select();
}

$("recoverySubmit").addEventListener("click",submitRecoveryAnswer);
$("recoveryInput").addEventListener("keydown",e=>{
  if((e.ctrlKey||e.metaKey) && e.key==="Enter") submitRecoveryAnswer();
});
$("recoveryDialog").addEventListener("cancel",e=>e.preventDefault());
$("recoveryDialog").addEventListener("close",()=>document.body.classList.remove("recovery-open"));

const priorApplyPollutionEffectsSwarm = applyPollutionEffects;
applyPollutionEffects = function(){
  priorApplyPollutionEffectsSwarm();
  syncSwarmEngine();
  if(state.pollution >= 82 && !criticalSince) criticalSince=Date.now();
};

/* Replace the old fixed-size flood with a living, accumulating field. */
buildWarningFlood = function(){
  const root=$("warningFlood");
  if(!root) return;
  if(state.pollution < 35){ root.innerHTML=""; return; }
  if(!root.childElementCount){
    const seedCount=state.pollution < 55 ? 12 : state.pollution < 75 ? 32 : 68;
    swarmBurst(seedCount);
  }
};

/* ===== QUIET OVERLAP HORROR: TEXT INFESTATION AT 80% ===== */
const BELIEF_SENTENCE = "재난관리국을 아직도 믿고 있어?";
let beliefTimer = null;
let beliefGeneration = 0;

function clearBeliefInfestation(){
  beliefGeneration++;
  if(beliefTimer){ clearTimeout(beliefTimer); beliefTimer=null; }
  const prose=$("sceneText");
  if(!prose) return;
  prose.classList.remove("polluted-prose");
  prose.removeAttribute("data-ghost");
  const layer=prose.querySelector(".story-infestation");
  if(layer) layer.remove();
}

function beliefDelay(){
  if(state.pollution < 80) return 0;
  if(state.pollution < 86) return 430;
  if(state.pollution < 92) return 210;
  if(state.pollution < 97) return 95;
  return 42;
}

function getBeliefLayer(){
  const prose=$("sceneText");
  if(!prose) return null;
  let layer=prose.querySelector(".story-infestation");
  if(!layer){
    layer=document.createElement("span");
    layer.className="story-infestation";
    layer.setAttribute("aria-hidden","true");
    prose.appendChild(layer);
  }
  return layer;
}

function typeBeliefLine(node,text,generation){
  let i=0;
  const speed=state.pollution >= 94 ? 7 : state.pollution >= 88 ? 11 : 17;
  const write=()=>{
    if(generation!==beliefGeneration || state.pollution<80 || !node.isConnected) return;
    i += state.pollution>=95 ? 3 : state.pollution>=89 ? 2 : 1;
    node.textContent=text.slice(0,i);
    if(i<text.length) setTimeout(write,speed);
  };
  write();
}

function spawnBeliefLine(generation){
  if(generation!==beliefGeneration || state.pollution<80) return;
  const layer=getBeliefLayer();
  const prose=$("sceneText");
  if(!layer || !prose) return;

  prose.classList.add("polluted-prose");
  prose.dataset.ghost=(prose.innerText || "").replaceAll(BELIEF_SENTENCE,"").slice(0,900);

  const line=document.createElement("span");
  line.className="belief-line";
  if(Math.random()<.28) line.classList.add("is-whisper");
  if(Math.random()<.2) line.classList.add("is-dense");
  if(Math.random()<.38) line.classList.add("is-faded");
  line.style.left=`${-3+Math.random()*89}%`;
  line.style.top=`${Math.random()*96}%`;
  line.style.setProperty("--belief-opacity",String(.22+Math.random()*.43));
  line.style.transform=`translateY(2px) rotate(${-1.4+Math.random()*2.8}deg)`;
  layer.appendChild(line);
  typeBeliefLine(line,BELIEF_SENTENCE,generation);

  const cap=state.pollution>=97 ? 380 : state.pollution>=92 ? 250 : state.pollution>=86 ? 150 : 76;
  while(layer.childElementCount>cap) layer.removeChild(layer.firstElementChild);
}

function runBeliefInfestation(){
  clearBeliefInfestation();
  if(state.pollution<80) return;
  const generation=beliefGeneration;
  const seed=state.pollution>=94 ? 22 : state.pollution>=88 ? 12 : 6;
  for(let i=0;i<seed;i++) setTimeout(()=>spawnBeliefLine(generation),i*55);

  const loop=()=>{
    if(generation!==beliefGeneration || state.pollution<80) return;
    const batch=state.pollution>=97 ? 5 : state.pollution>=92 ? 3 : state.pollution>=86 ? 2 : 1;
    for(let i=0;i<batch;i++) setTimeout(()=>spawnBeliefLine(generation),i*18);
    beliefTimer=setTimeout(loop,beliefDelay());
  };
  beliefTimer=setTimeout(loop,beliefDelay());
}

const renderSceneBeforeBelief=renderScene;
renderScene=function(id){
  renderSceneBeforeBelief(id);
  runBeliefInfestation();
};

const applyPollutionBeforeBelief=applyPollutionEffects;
applyPollutionEffects=function(){
  applyPollutionBeforeBelief();
  runBeliefInfestation();
};

/* 복구 성공 시 본문 침식도 함께 즉시 제거한다. */
const submitRecoveryBeforeBelief=submitRecoveryAnswer;
submitRecoveryAnswer=function(){
  submitRecoveryBeforeBelief();
  if(state.pollution===0) clearBeliefInfestation();
};
