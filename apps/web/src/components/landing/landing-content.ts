export type Scene = {
  tag: string;
  who: string;
  context: string;
  line: string;
  effect: string;
  imageSrc: string;
  imageAlt: string;
  imageSide: 'left' | 'right';
};

export type Benefit = {
  n: string;
  title: string;
  body: string;
};

export type Explainer = {
  n: string;
  title: string;
  body: string;
};

export type Phase = 'done' | 'active' | 'planned';

export const EXPLAINERS: Explainer[] = [
  {
    n: '01',
    title: '不是语音转文字，是先听懂你想做什么。',
    body: '你说的是一句大白话，MuiMemo 记住的是一件待办。动作、对象、时间线索都会被拆出来，而不是整句原样躺着。',
  },
  {
    n: '02',
    title: '不是先整理完才可用，是记下就能进入清单。',
    body: '时间、优先级、归哪一堆，先由 AI 帮你补上。你不用停下来填表，事情已经有了基本秩序。',
  },
  {
    n: '03',
    title: '不是所有事一起吵，是到对应场景才浮出来。',
    body: '在家、在公司、在外面，或你正在处理某件事时，相关任务会自己靠前。清单终于像当下，而不是像仓库。',
  },
];

export const SCENES: Scene[] = [
  {
    tag: '店主',
    who: '王姐',
    context: '货架、收银台、找零同时在手上，手脏的时候更不想在表单里点来点去。',
    line: '晚上给老张结 3000 尾款。',
    effect: '先把这句收成任务。晚上她一说“开始打款”，相关转账事项自己浮出来，能在同一个节奏里一口气清掉。',
    imageSrc: '/landing/shopkeeper-scene.webp',
    imageAlt: '小卖铺店主站在收银台和货架之间忙着手上的活，一边对着手机口述今晚要给老张结尾款。',
    imageSide: 'right',
  },
  {
    tag: '带娃的人',
    who: '李妈',
    context: '宝宝一闹，注意力就被切碎。出门前那几件最要紧的小事，最容易漏在门口。',
    line: '明天早上带娃去打疫苗，记得带出生证。',
    effect:
      'MuiMemo 会把“去打疫苗”和“带出生证”一起收住，挂到明早那一段。临出门前看一眼，不必再回想刚才脑子里那句原话。',
    imageSrc: '/landing/parent-scene.webp',
    imageAlt: '一位带娃的家长在出门前的玄关整理包和证件，周围散着孩子用品，同时对着手机记下明早打疫苗要带出生证。',
    imageSide: 'left',
  },
  {
    tag: '自由职业者',
    who: '接单的设计师小杨',
    context: '几个客户同时催不同方向的活，最怕的是刚切进 A 项目，脑子里还混着 B 和 C。',
    line: '开始做 A 客户的 logo。',
    effect:
      '一句“开始做 A 客户”，MuiMemo 就把这个客户相关的任务往前提，别的先安静下来。不是多一个系统，而是少一点切换成本。',
    imageSrc: '/landing/freelancer-scene.webp',
    imageAlt: '自由职业设计师坐在工作台前处理多个客户任务，桌面上有稿纸和设备，他对着手机说开始做 A 客户的 logo。',
    imageSide: 'right',
  },
];

export const BENEFITS: Benefit[] = [
  {
    n: '01',
    title: '不用分字段',
    body: '不必先想这句该填标题、截止时间还是标签。先把话说出去，结构留给 AI。',
  },
  {
    n: '02',
    title: '不用背关键词',
    body: '后来想起“上次那个给老张转钱的事”，也能顺着人和情境找回来，不必猜自己当时写了什么字眼。',
  },
  {
    n: '03',
    title: '不用手动找对应项',
    body: '说“我现在去办转账”或“那笔已经打了”，相关任务会被定位、提起、勾掉。你不用在清单里来回翻。',
  },
];

export const ROADMAP: Array<{
  n: string;
  title: string;
  body: string;
  phase: Phase;
}> = [
  {
    n: 'Phase 1',
    title: '网页版 · 先用起来',
    body: '说一句话就记下，想找就搜到。手机浏览器打开就能用，也能装进主屏幕当 app。',
    phase: 'done',
  },
  {
    n: 'Phase 2',
    title: 'iOS App · 把体验做到位',
    body: '不用打开 app，对 Siri 说一句就记下。录音时能立刻看到文字，提醒也交给系统做，时间到了更稳。',
    phase: 'active',
  },
  {
    n: 'Phase 3',
    title: '日常延伸',
    body: 'iCloud 同步、主屏小组件、一秒进入录音——让 MuiMemo 藏在手指最顺手的地方。',
    phase: 'planned',
  },
  {
    n: 'Phase 4',
    title: '桌面端串联',
    body: '电脑前敲字也顺手，手机和桌面保持一致，换设备不用重新适应。',
    phase: 'planned',
  },
];

export const FAQ: Array<{ q: string; a: string }> = [
  {
    q: '一定要联网吗？能离线用吗？',
    a: '当前网页版需要联网。说的话要交给 AI 去听、去理解，结果也要存到云端。正在进行中的 iOS App 会逐步补上更可靠的离线体验。',
  },
  {
    q: '能准时提醒我吗？',
    a: '网页版暂时不太行，手机浏览器的提醒并不稳定。准时提醒会交给正在做的 iOS App，用系统能力才靠谱。',
  },
  {
    q: '支持方言 / 口音吗？',
    a: '普通话和带口音普通话基本都能听懂。粤语、川话这些方言实测因人而异，建议先从短句开始试。',
  },
  {
    q: '我说的话会被拿去训练 AI 吗？',
    a: '不会。录音只用于当次识别，可选归档也只有你自己能看。想删的话，在“输入记录”里可以一键清掉。',
  },
  {
    q: '要收费吗？',
    a: '现在是个人项目，免费注册就能用。如果将来调整收费，我会先把边界讲清楚，不会突然改。',
  },
];
