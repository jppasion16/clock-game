/** Dynamic seven-segment readout; no CDN or webfonts needed. */
function createSevenSegmentClock(container, initialTime = '4:00') {
  const NS = 'http://www.w3.org/2000/svg';
  const segments = {
    a: '7,2 27,2 23,6 11,6',
    b: '28,3 32,7 32,24 28,28 25,24 25,9',
    c: '28,32 32,36 32,53 28,57 25,51 25,36',
    d: '7,58 27,58 23,54 11,54',
    e: '4,32 7,36 7,51 4,57 0,53 0,36',
    f: '4,3 7,9 7,24 4,28 0,24 0,7',
    g: '7,30 11,27 23,27 27,30 23,33 11,33'
  };
  const digits = {
    '0':'abcdef','1':'bc','2':'abged','3':'abgcd','4':'fgbc',
    '5':'afgcd','6':'afgecd','7':'abc','8':'abcdefg','9':'abfgcd'
  };
  const svg = document.createElementNS(NS,'svg');
  svg.setAttribute('aria-hidden','true');
  svg.style.cssText='display:block;width:100%;height:100%;overflow:visible';
  const groups=[];
  for (let i=0;i<4;i++) {
    const g=document.createElementNS(NS,'g');
    const x = (i===0 ? 4 : i===1 ? 53 : i===2 ? 110 : 155);
    g.setAttribute('transform',`translate(${x},2)`);
    for (const [seg,points] of Object.entries(segments)) {
      const p=document.createElementNS(NS,'polygon');
      p.setAttribute('points',points);
      p.dataset.segment=seg;
      g.appendChild(p);
    }
    svg.appendChild(g);groups.push(g);
  }
  const colon = document.createElementNS(NS,'g');
  colon.setAttribute('fill','#cf1b00');
  for (const y of [20,43]) {const dot=document.createElementNS(NS,'rect');dot.setAttribute('x','94');dot.setAttribute('y',String(y));dot.setAttribute('width','8');dot.setAttribute('height','8');dot.setAttribute('rx','1');colon.appendChild(dot);}
  svg.appendChild(colon);
  const announcement = document.createElement('span');
  announcement.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)';
  container.replaceChildren(svg, announcement);

  function renderTime(time) {
    const [hr,mn] = String(time).split(':');
    const padded=hr.padStart(2,' ')+mn.padStart(2,'0');
    svg.setAttribute('viewBox', hr.length === 1 ? '24 0 192 64' : '0 0 192 64');
    [...padded].forEach((c,i)=>{
      [...groups[i].children].forEach(p=>{
        p.setAttribute('fill','#c71900');
        p.setAttribute('opacity',digits[c]?.includes(p.dataset.segment)?'1':'0');
      });
    });
  }

  function setTime(time) {
    renderTime(time);
    announcement.textContent = time;
  }

  function startShuffle(targetTime, signal) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const slotsPerHour = 12;
    const slotCount = 12 * slotsPerHour;
    let previousTime;
    let shuffleTimer;
    let briefTimer;
    let finishBriefWait;
    let settle;

    function shuffle() {
      let slot = Math.floor(Math.random() * slotCount);
      let time;
      do {
        const hour = Math.floor(slot / slotsPerHour) || 12;
        const minute = String(slot % slotsPerHour * 5).padStart(2, '0');
        time = `${hour}:${minute}`;
        slot = (slot + 1) % slotCount;
      } while (time === targetTime || time === previousTime);
      previousTime = time;
      renderTime(time);
    }

    announcement.textContent = '';
    svg.style.visibility = reducedMotion ? 'hidden' : '';
    if (!reducedMotion) {
      shuffle();
      shuffleTimer = setInterval(shuffle, 130);
    }

    function cancel() {
      clearInterval(shuffleTimer);
      clearTimeout(briefTimer);
      finishBriefWait?.();
      settle?.cancel();
    }
    signal.addEventListener('abort', cancel, { once: true });

    return async function reveal({ brief = false, immediate = false } = {}) {
      if (signal.aborted) return;
      if (brief && !reducedMotion) {
        await new Promise((resolve) => {
          finishBriefWait = resolve;
          briefTimer = setTimeout(resolve, 260);
        });
      }
      if (signal.aborted) return;

      clearInterval(shuffleTimer);
      svg.style.visibility = '';
      renderTime(targetTime);
      if (!reducedMotion && !immediate && svg.animate) {
        settle = svg.animate([{ transform: 'scale(.94)' }, { transform: 'scale(1)' }], {
          duration: 150, easing: 'ease-out'
        });
        await settle.finished.catch(() => {});
      }
      if (signal.aborted) return;

      announcement.textContent = targetTime;
      signal.removeEventListener('abort', cancel);
    };
  }

  setTime(initialTime);
  return { element: svg, setTime, startShuffle };
}
