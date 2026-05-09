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
    title: '不只是记下，整张清单都能用嘴操控。',
    body: '说一句新事就建一条；说「改到下午三点」就改时间；说「物业费搞定了」就勾掉；说「上次老张那事」就把它捞回来。AI 不止做录入，整个 todo 生命周期它都接。',
  },
  {
    n: '02',
    title: '不是先整理完才可用，记下立刻有秩序。',
    body: '时间、优先级、归哪一堆，AI 帮你补上；说错或想拆开还能让它重新拆。你不必停下来填表，事情已经能在合适的场景里浮出来。',
  },
  {
    n: '03',
    title: '不止管你一个人——下一步是把事派给身边人。',
    body: '在做的协作功能：说一句「@豆豆 帮我下午接娃」，对方手机里就出现这条任务。家庭、店铺、小团队的零碎活儿，都用语音派、用语音确认。',
  },
];

export const SCENES: Scene[] = [
  {
    tag: '店主',
    who: '王姐',
    context: '货架、收银台、找零同时在手上，手脏的时候更不想在表单里点来点去。',
    line: '晚上给老张结 3000 尾款；对了，明早八点去市场补一批酱油。',
    effect: '一句话两件事，叨叨记自动拆成两条。晚上她说「开始打款」，转账事项浮上来；早上去市场，「补酱油」自己冒头。',
    imageSrc: '/landing/shopkeeper-scene.webp',
    imageAlt: '小卖铺店主站在收银台和货架之间忙着手上的活，一边对着手机口述今晚要给老张结尾款。',
    imageSide: 'right',
  },
  {
    tag: '带娃的人',
    who: '李妈',
    context: '宝宝一闹注意力就被切碎，门口那几件最要紧的小事最容易漏。',
    line: '明天早上带娃打疫苗，记得带出生证。打完跟我说一声让我也勾掉。',
    effect:
      '叨叨记把「打疫苗」和「带出生证」一起收住挂到明早。打完了说「疫苗打了」就自动勾掉——之后还能 @ 给爸爸让他带出生证。',
    imageSrc: '/landing/parent-scene.webp',
    imageAlt: '一位带娃的家长在出门前的玄关整理包和证件，周围散着孩子用品，同时对着手机记下明早打疫苗要带出生证。',
    imageSide: 'left',
  },
  {
    tag: '自由职业者',
    who: '接单的设计师小杨',
    context: '几个客户同时催不同方向的活，最怕的是刚切进 A 项目，脑子里还混着 B 和 C。',
    line: '开始做 A 客户的 logo；上周说要给 B 客户改 banner 那条，推到这周五。',
    effect:
      '一句话同时切场景 + 改时间。说「开始做 A」就把 A 相关任务往前提，B 客户的 banner 自动延后到周五。不是多一个系统，是少一点切换成本。',
    imageSrc: '/landing/freelancer-scene.webp',
    imageAlt: '自由职业设计师坐在工作台前处理多个客户任务，桌面上有稿纸和设备，他对着手机说开始做 A 客户的 logo。',
    imageSide: 'right',
  },
];

export const BENEFITS: Benefit[] = [
  {
    n: '01',
    title: '一句话就能拆',
    body: '想到几件事一口气说完，AI 自动拆成几条独立任务，各自能勾、能改、能找。',
  },
  {
    n: '02',
    title: '一句话就能找回',
    body: '记不清原话也没关系。说「上次那个给老张转钱的事」，靠人 + 情境捞回来，不用猜自己当时写的字眼。',
  },
  {
    n: '03',
    title: '一句话就能动手',
    body: '说「我现在去办转账」相关任务上前；说「那笔已经打了」自动勾掉；说「改到下周一」时间就变了。整个清单跟着你的话同步。',
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
    body: '不用打开 app，对 Siri 说一句就记下。录音时能立刻看到文字，提醒交给系统做，时间到了更稳。',
    phase: 'active',
  },
  {
    n: 'Phase 3',
    title: '日常延伸',
    body: 'iCloud 同步、主屏小组件、Apple Watch 一秒开录——让叨叨记藏在手指最顺手的地方。',
    phase: 'planned',
  },
  {
    n: 'Phase 4',
    title: '语音搜索 + 自动整理',
    body: '说一句话把堆久的清单合并、分组；说「上次说过的 X」一秒找到；定期帮你清理过期任务。',
    phase: 'planned',
  },
  {
    n: 'Phase 5',
    title: '协作 · 把事派给身边人',
    body: '@ 你的联系人、家庭群、小团队，把任务派出去；对方做完一句话回收。家务分工 / 店铺接力 / 小工作室并肩做事，都靠语音串起来。',
    phase: 'planned',
  },
];

export const FAQ: Array<{ q: string; a: string }> = [
  {
    q: '免费可以用多少？',
    a: '每个月 120 次 AI 操作（建任务、改、勾掉都算一次），平均每天 4 次，普通用户够用。任务条数、云同步、查找历史不限。超出再升级到 Pro。详情见 [价格页](/pricing)。',
  },
  {
    q: '一定要联网吗？能离线用吗？',
    a: '当前网页版需要联网。说的话要交给 AI 听、去理解，结果也要存到云端。正在做的 iOS App 会逐步补上更可靠的离线体验。',
  },
  {
    q: '能准时提醒我吗？',
    a: '网页版暂时不太行，浏览器提醒并不稳定。准时提醒交给 iOS App，用系统能力才靠谱。',
  },
  {
    q: '支持方言 / 口音吗？',
    a: '普通话和带口音普通话基本能听懂。粤语、川话这些方言实测因人而异，建议先从短句开始试。',
  },
  {
    q: '我说的话会被拿去训练 AI 吗？',
    a: '叨叨记不会把你的内容公开给其他用户；当前语音会发送给 AI 做当次解析，相关录音和附件存入你自己的账号数据。详情见 [隐私说明](/privacy)。',
  },
  {
    q: '协作功能什么时候上？',
    a: '在做。Phase 5：「@ 联系人、把任务派给伙伴」是接下来的重点方向，给小团队 / 家庭 / 店铺零碎活儿用的。订阅 Pro 的人会优先拿到内测邀请。',
  },
];
