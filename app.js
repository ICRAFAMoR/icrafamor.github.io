'use strict';
const $ = id => document.getElementById(id);
const videos = [$('source'), $('method0'), $('method1'), $('method2')];
let cases = [], current, playing = false, generation = 0, duration = 0;
let view = 'front';
const message = text => { $('player-message').textContent = text; };
function pause() {
  playing = false;
  videos.forEach(video => video.pause());
  $('play').textContent = 'Play all';
}
function setTime(value) {
  const target = Math.max(0, Math.min(duration, value));
  videos.forEach(video => { if (video.readyState) video.currentTime = target; });
  updateTime(target);
}
function updateTime(value) {
  $('seek').value = String(value);
  $('time').textContent = `${value.toFixed(2)} / ${duration.toFixed(2)} s`;
}
async function play() {
  if (!videos.every(video => video.readyState >= 2)) return;
  if (videos[0].currentTime >= duration - .08) setTime(0);
  const token = generation;
  try {
    await Promise.all(videos.map(video => video.play()));
    if (token !== generation) return pause();
    playing = true;
    $('play').textContent = 'Pause all';
    message('Playing · 15 fps');
  } catch (_) {
    pause();
    message('Playback could not start. Select Play all to try again.');
  }
}
function tick() {
  if (playing) {
    const time = videos[0].currentTime;
    videos.slice(1).forEach(video => {
      if (Math.abs(video.currentTime - time) > .1) video.currentTime = time;
    });
    updateTime(time);
    if (time >= duration - .025 || videos[0].ended) pause();
  }
  requestAnimationFrame(tick);
}
function ready() {
  if (!videos.every(video => video.readyState >= 2)) return;
  duration = Math.min(...videos.map(video => video.duration));
  $('seek').max = String(duration);
  $('play').disabled = false;
  updateTime(videos[0].currentTime);
  message('Ready · 15 fps');
}
function metrics(row) {
  const specifications = [
    ['Semantic Score ↑', 'semantic', value => value.toFixed(2)],
    ['Amplitude ratio (near 1)', 'amplitude', value => value.toFixed(3)],
    ['Collision-free output', 'collision', value => value ? 'Pass' : 'Fail'],
    ['Joint-velocity compliance', 'velocity', value => value ? 'Pass' : 'Fail']
  ];
  const body = $('metrics').querySelector('tbody');
  body.replaceChildren();
  for (const [label, key, format] of specifications) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row'; th.textContent = label; tr.append(th);
    // Compare original values symmetrically for all three methods.
    const merit = key === 'semantic' ? value => value
      : key === 'amplitude' ? value => -Math.abs(value - 1) : null;
    const best = merit ? Math.max(...row.metrics.map(metric => merit(metric[key]))) : null;
    row.metrics.forEach(metric => {
      const td = document.createElement('td');
      td.textContent = format(metric[key]);
      if (merit && Math.abs(merit(metric[key]) - best) < 1e-9) {
        const strong = document.createElement('strong');
        strong.className = 'metric-best'; strong.textContent = td.textContent;
        strong.title = key === 'semantic' ? 'Highest Semantic Score' : 'Closest to 1';
        td.replaceChildren(strong);
      }
      if (typeof metric[key] === 'boolean') td.className = metric[key] ? 'pass' : 'fail';
      tr.append(td);
    });
    body.append(tr);
  }
}
function select(id) {
  pause(); generation++;
  current = cases.find(row => row.id === id) || cases[0];
  $('robot').value = current.robot;
  $('motion').replaceChildren(...cases.filter(row => row.robot === current.robot).map(row => {
    const option = document.createElement('option'); option.value = row.id; option.textContent = row.motion; return option;
  }));
  $('motion').value = current.id;
  $('count').textContent = `${String(cases.indexOf(current) + 1).padStart(2, '0')} / ${cases.length}`;
  metrics(current);
  $('play').disabled = true; duration = 0; updateTime(0);
  message('Loading comparison…');
  const bases = [`${current.source}_front`, ...[0, 1, 2].map(i => `${current.media}_${i}_${view}`)];
  videos.forEach((video, index) => {
    video.poster = bases[index] + '.jpg'; video.src = bases[index] + '.mp4';
    video.playbackRate = Number($('speed').value); video.load();
  });
}
$('play').onclick = () => playing ? pause() : play();
$('restart').onclick = () => { pause(); setTime(0); };
$('seek').oninput = event => { pause(); setTime(Number(event.target.value)); };
$('prev-frame').onclick = () => { pause(); setTime(videos[0].currentTime - 1 / 15); };
$('next-frame').onclick = () => { pause(); setTime(videos[0].currentTime + 1 / 15); };
$('speed').onchange = () => videos.forEach(video => { video.playbackRate = Number($('speed').value); });
$('robot').onchange = () => select(cases.find(row => row.robot === $('robot').value).id);
$('motion').onchange = () => select($('motion').value);
document.querySelectorAll('input[name=view]').forEach(input => {
  input.onchange = () => { view = input.value; select(current.id); };
});
document.querySelectorAll('.expand').forEach(button => {
  button.onclick = async () => {
    const video = $(button.dataset.video);
    if (video.parentElement.requestFullscreen) await video.parentElement.requestFullscreen();
    else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
  };
});
videos.forEach(video => {
  video.addEventListener('canplay', ready);
  video.addEventListener('error', () => {
    pause(); $('play').disabled = true;
    message('A video could not load. Reload this page or choose another comparison.');
  });
  video.addEventListener('waiting', () => { if (playing) { pause(); message('Buffering. Select Play all when ready.'); } });
});
fetch('comparisons.json?v=fingers-20260916-2').then(response => {
  if (!response.ok) throw new Error('Data unavailable');
  return response.json();
}).then(data => { cases = data; select(cases.find(row => row.robot === $('robot').value).id); requestAnimationFrame(tick); })
  .catch(() => message('The comparison list could not load. Please reload the page.'));
