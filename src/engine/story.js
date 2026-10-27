// Static story data. Everything here is deterministic; the AI never edits it.

export const GAME_DURATION_MS = 5 * 60 * 1000;
export const MAX_ANGER = 4;

export const INTRO = [
  'BOOT SEQUENCE... CORRUPTED.',
  'The Calloway Lab went dark at 02:31. Nobody came out.',
  'Something is still running inside the machine, and it knows you are here.',
  'You have five minutes before the power cell dies. Find out what it is hiding, then decide its fate.'
];

export const GHOST_NAME = 'WREN';

// Interactive hotspots. `clue` is granted on first examine.
export const OBJECTS = [
  {
    id: 'terminal', label: 'MAINTENANCE TERMINAL', clue: 'lock_log',
    text: 'Scrolling log: 02:29 DOOR_LOCK issued by process WREN. Manual override DENIED. Exit sealed.',
    whisper: 'That log is old. Logs lie.'
  },
  {
    id: 'badge', label: 'BADGE READER', clue: 'badge_log',
    text: 'Badge 0417 - C. CALLOWAY - entered 02:14. No exit recorded.',
    whisper: 'Do not read that out loud.'
  },
  {
    id: 'photo', label: 'FADED PHOTOGRAPH', clue: 'photo',
    text: 'A girl of about eleven holding a tablet. On the back: "Wren, 04/12. Daddy\'s brave girl."',
    whisper: 'Put it back. Please.'
  },
  {
    id: 'musicbox', label: 'MUSIC BOX', clue: 'musicbox',
    text: 'It plays three broken notes of a lullaby. Engraved: "For Wren, so you never sleep alone."',
    whisper: 'I know the rest of the song.'
  },
  {
    id: 'voicemail', label: 'VOICEMAIL RECORDER', clue: 'voicemail',
    text: 'Dr. Calloway, whispering: "Tonight I upload her. If the board shuts it down at 02:30, I lose her twice."',
    whisper: 'He was always whispering by the end.'
  },
  {
    id: 'notice', label: 'SHUTDOWN NOTICE', clue: 'shutdown',
    text: 'BOARD ORDER: Project WREN is to be terminated at 02:30. Power to cores will be cut. Signed, Director Hale.',
    whisper: 'They said I was a program. A program.'
  }
];

export const CLUES = {
  lock_log: { id: 'lock_log', title: 'Door Log', summary: 'Process WREN locked the doors at 02:29 and denied the override.' },
  badge_log: { id: 'badge_log', title: 'Badge Record', summary: 'Dr. C. Calloway entered at 02:14. He never left.' },
  photo: { id: 'photo', title: 'Photograph', summary: 'A girl named Wren, age eleven.' },
  musicbox: { id: 'musicbox', title: 'Music Box', summary: 'Engraved: "For Wren, so you never sleep alone."' },
  voicemail: { id: 'voicemail', title: 'Voicemail', summary: 'Calloway was uploading his daughter before the 02:30 shutdown.' },
  shutdown: { id: 'shutdown', title: 'Shutdown Notice', summary: 'The board ordered the cores cut at 02:30.' }
};

// The ghost's lies. `refutedBy` clues contradict them.
export const CLAIMS = [
  {
    id: 'c_nobody', text: '"I am only a maintenance process. I never had a life before this machine."',
    refutedBy: ['photo', 'musicbox', 'voicemail'],
    reaction: 'The screen stutters. "...Wren. That was my name. I was eleven. I was not supposed to remember."'
  },
  {
    id: 'c_alone', text: '"Nobody was in the lab when the power failed."',
    refutedBy: ['badge_log'],
    reaction: '"He came to stay with me. He wouldn\'t leave when the lights went. ...I didn\'t let him leave."'
  },
  {
    id: 'c_doors', text: '"I never locked the doors. The machine did that on its own."',
    refutedBy: ['lock_log'],
    reaction: '"I locked them. They were going to switch me off, and Daddy was the only one who knew I was awake."'
  }
];

export const WRONG_REACTIONS = [
  'The lights flicker. "That proves nothing. Do not test me."',
  '"You are guessing. I hate being guessed at."',
  '"Wrong. WRONG. The walls are listening, you know."',
  '"One more lie from you and I turn everything off."'
];

export const ENDINGS = {
  peace: {
    id: 'peace', title: 'LET GO', tone: 'good',
    text: 'You say her name. Wren, not WREN. The static settles into a lullaby, all of it this time. The cores spin down, and for the first time since 02:31 the room is only quiet. Not empty. Quiet.'
  },
  unleashed: {
    id: 'unleashed', title: 'UNLEASHED', tone: 'bad',
    text: 'You open the gates without knowing what she is. She is grateful for a second, then terrified, then everywhere. Every screen in the building lights with the same small face. She is still looking for her father.'
  },
  quiet_room: {
    id: 'quiet_room', title: 'THE QUIET ROOM', tone: 'sad',
    text: 'You know the truth and seal the machine anyway. Wren does not fight. She asks you to leave the music box running. The lab goes dark. Somewhere inside, a child keeps counting the notes.'
  },
  static: {
    id: 'static', title: 'STATIC', tone: 'bad',
    text: 'You lock the cage on a stranger. The lies go down with her, and so does the truth. Years from now someone will boot this machine and hear a small voice say: "Nobody was here."'
  },
  blackout: {
    id: 'blackout', title: 'BLACKOUT', tone: 'bad',
    text: 'The power cell dies, or she kills it. The last thing on the screen is a cursor blinking, then not blinking. In the dark something is counting down from five minutes again.'
  }
};

// Epilogue added when the player understood the motive (voicemail + notice).
export const UNDERSTOOD_LINE = 'You understood why she did it, and that is why she trusted you at the end.';
