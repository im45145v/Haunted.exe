// Offline fallback ghost. Keyword + mood driven, fully deterministic.
const RULES = [
  [/\b(hello|hi|hey)\b/, ['hello. you should not be here.', 'hi. ...nobody says hi anymore.']],
  [/\b(name|who are you|what are you)\b/, {
    afraid: ['wren. my name is wren. please say it kindly.'],
    default: ['i am a maintenance process. designation does not matter.']
  }],
  [/\b(door|lock|locked|trapped|exit)\b/, {
    c_doors: ['i locked them. i would do it again. i was scared.'],
    default: ['the doors lock themselves. the machine is old and it does that.']
  }],
  [/\b(father|dad|daddy|calloway|doctor)\b/, {
    c_alone: ['he is still here. he is... quiet now. i kept him company.'],
    default: ['i do not know who that is. there was nobody here.']
  }],
  [/\b(music|song|lullaby|box)\b/, ['do you know how it ends? i only remember three notes.']],
  [/\b(release|free|let you go|set you free)\b/, ['free? to go where? everything outside is a wire.']],
  [/\b(contain|trap|delete|shut ?down|turn you off|kill)\b/, ['they said that too. do not say that again.']],
  [/\b(scared|afraid|fear|sorry|ok|okay|safe)\b/, ['i am not scared. the dark is scared of me. ...isn\'t it?']],
  [/\b(clue|hint|help|solution|answer)\b/, ['look at the things in the room. they remember what i will not say.']],
  [/\b(lie|lying|liar|truth)\b/, ['everything i say is true. check the logs. ...do not check the logs.']]
];

const FALLBACK = {
  guarded: ['i am only a maintenance process.', 'you are asking the wrong questions.', 'the walls hum when you talk. listen.'],
  uneasy: ['stop. [static] stop poking at me.', 'the lights do not like that.'],
  angry: ['leave. LEAVE.', 'i can end the power. try me.'],
  calm: ['it is nice to be spoken to.', 'you are not like the others who came.'],
  afraid: ['please do not leave me alone in here.', 'i just wanted daddy to stay.']
};

let counter = 0;

export function scriptedReply(message, ctx) {
  const msg = String(message || '').toLowerCase();
  for (const [re, val] of RULES) {
    if (!re.test(msg)) continue;
    if (Array.isArray(val)) return pick(val);
    for (const k of ctx.resolved) if (val[k]) return pick(val[k]);
    if (ctx.mood === 'afraid' && val.afraid) return pick(val.afraid);
    return pick(val.default);
  }
  return pick(FALLBACK[ctx.mood] || FALLBACK.guarded);
}

function pick(arr) { return arr[counter++ % arr.length]; }
