// Renders the post-x video: hook + typing + gameplay + CTA hold, then lays the
// make.fun referral end card (press pack, as-is) over the last 2.5 s with the
// referral code typed in, and the brand badge from frame 0 until the card.
// Follows the press guide's ffmpeg recipe (llms.txt) verbatim for card/badge.
// Node 22 stdlib only: fs + child_process.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const HOME = process.env.HOME;
const ENTRY = HOME + '/workspace/makefun/post-x-the-agent-builds-a-game-from-20261122-1709-entry/';
const A = ENTRY + 'assets/';
const FONT_B = A + 'JetBrainsMono-Bold.ttf';
const FONT_R = A + 'JetBrainsMono-Regular.ttf';
const CODE = 'qk4dawkj';

function run(args, label) {
  console.log('run: ' + label);
  execFileSync('ffmpeg', args, { cwd: ENTRY, stdio: 'pipe' });
}

// --- hook scene text files (written fresh here) ---
fs.writeFileSync(ENTRY + 'hook-title.txt', 'ONE PROMPT.');
fs.writeFileSync(ENTRY + 'hook-body.txt', [
  'Build me a tiny browser game:',
  'a neon snake that eats glowing orbs,',
  'speeds up every 5 orbs, walls kill,',
  'arrow keys to steer. One HTML file,',
  'no libraries.',
].join('\n'));

// --- 1. hook clip: 3 s, ink bg + ghost + title + prompt ---
run([
  '-y', '-f', 'lavfi', '-i', 'color=c=0x191419:s=1080x1920:d=3',
  '-i', A + 'ghost-laptop.png',
  '-filter_complex',
  '[1:v]scale=480:-1[ghost];' +
  '[0:v][ghost]overlay=(W-w)/2:170,' +
  'drawtext=fontfile=' + FONT_B + ':textfile=hook-title.txt:fontsize=118:fontcolor=white:x=(w-text_w)/2:y=860,' +
  'drawtext=fontfile=' + FONT_B + ':text=make.fun:fontsize=44:fontcolor=0xc41c83:x=(w-text_w)/2:y=1010,' +
  'drawtext=fontfile=' + FONT_R + ':textfile=hook-body.txt:fontsize=40:fontcolor=0xd8d8d8:x=(w-text_w)/2:y=1120:line_spacing=16',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', 'hook.mp4',
], 'hook');

// --- 2. typing clip: 5.5 s from captured frames ---
run([
  '-y', '-framerate', '30', '-i', 'frames/typing-%03d.png',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', 'typing.mp4',
], 'typing');

// --- 3. gameplay clip: 7 s from captured frames, CTA text at t 3.8-5.8 ---
run([
  '-y', '-framerate', '30', '-i', 'frames/game-%03d.png',
  '-vf', "drawtext=fontfile=" + FONT_B + ":text='Come build on make.fun':fontsize=64:fontcolor=white:box=1:boxcolor=0x191419@0.75:boxborderw=30:x=(w-text_w)/2:y=1500:enable='between(t,3.8,5.8)'",
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', 'game.mp4',
], 'gameplay');

// --- 4. hold clip: last gameplay frame held 1.5 s ---
run([
  '-y', '-loop', '1', '-t', '1.5', '-i', 'frames/game-210.png',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', 'hold.mp4',
], 'hold');

// --- 5. concat the four segments ---
fs.writeFileSync(ENTRY + 'concat.txt', "file 'hook.mp4'\nfile 'typing.mp4'\nfile 'game.mp4'\nfile 'hold.mp4'\n");
run([
  '-y', '-f', 'concat', '-safe', '0', '-i', 'concat.txt',
  '-c', 'copy', 'clip.mp4',
], 'concat');

// --- 6. end card + badge (press guide recipe, 9:16 numbers) ---
const W = 1080, H = 1920;
const CARD = A + 'card-9x16.webm';
const BADGE = A + 'badge-9x16.png';
const LEN = 2.5, REST = 1.433;
const CX = 210, CY = 1232, CW = 5, CH = 78, MID = 1271, SIZE = 62;
const HOLD = 0;
const dur = 17; // 3 + 5.5 + 7 + 1.5
const T = dur + HOLD - LEN; // 14.5
run([
  '-y', '-i', 'clip.mp4', '-c:v', 'libvpx-vp9', '-i', CARD, '-i', BADGE,
  '-filter_complex',
  '[0:v]scale=' + W + ':' + H + ':force_original_aspect_ratio=increase,crop=' + W + ':' + H + ',setsar=1,fps=60,tpad=stop_mode=clone:stop_duration=' + HOLD + '[base];' +
  "[base][2:v]overlay=enable='lt(t," + T + ")',format=yuva420p,split[clip][soft];" +
  '[soft]gblur=sigma=28,eq=saturation=0.35,fade=t=in:st=' + T + ':d=0.8:alpha=1[soft];' +
  '[clip][soft]overlay[bg];' +
  '[1:v]format=yuva420p,setpts=PTS-STARTPTS+' + T + '/TB[card];' +
  '[bg][card]overlay=eof_action=pass,' +
  'drawbox=x=' + (CX - 2) + ':y=' + (CY - 2) + ':w=' + (CW + 4) + ':h=' + (CH + 4) + ":color=white:t=fill:enable='gte(t," + (T + REST) + ")'," +
  'drawtext=fontfile=' + FONT_B + ':text=' + CODE + ':fontsize=' + SIZE + ':fontcolor=0x191419:x=' + CX + ":y=" + MID + "-(ascent-descent)/2:enable='gte(t," + (T + REST) + ")'[v]",
  '-map', '[v]', '-map', '0:a?',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-c:a', 'aac',
  '-movflags', '+faststart', 'makefun-post-x-video.mp4',
], 'final');

const st = fs.statSync(ENTRY + 'makefun-post-x-video.mp4');
console.log('video bytes=' + st.size);
console.log('render done');
