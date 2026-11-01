/* ================= MQ: tiny MQTT 3.1.1 client over WebSocket (QoS 0 only) ================= */
/* Used by the presenter page and the phone page to talk through public brokers. */
const MQ = (() => {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const u16 = n => [n >> 8 & 255, n & 255];
  const str = s => { const b = enc.encode(s); return [...u16(b.length), ...b]; };
  function varLen(n) { const out = []; do { let d = n % 128; n = Math.floor(n / 128); if (n) d |= 128; out.push(d); } while (n); return out; }
  function pkt(head, body) {
    const L = varLen(body.length), out = new Uint8Array(1 + L.length + body.length);
    out[0] = head; out.set(L, 1); out.set(body, 1 + L.length);
    return out;
  }
  function publishPkt(topic, payload, retain) {
    const t = str(topic), p = enc.encode(payload), body = new Uint8Array(t.length + p.length);
    body.set(t, 0); body.set(p, t.length);
    return pkt(0x30 | (retain ? 1 : 0), body);
  }

  function connect(url, o) {
    let ws = null, ok = false, tries = 0, ping = 0, buf = new Uint8Array(0), pid = 1;
    const topics = new Set(o.subs || []), queue = [];
    const nextId = () => (pid = pid % 65535 + 1);
    const send = b => { try { ws && ws.readyState === 1 && ws.send(b); } catch (e) {} };
    const sub = t => { if (ok) send(pkt(0x82, [...u16(nextId()), ...str(t), 0])); };

    function open() {
      try { ws = new WebSocket(url, 'mqtt'); } catch (e) { return retry(); }
      ws.binaryType = 'arraybuffer';
      ws.onopen = () => send(pkt(0x10, [...str('MQTT'), 4, 2, ...u16(60), ...str(o.id)]));
      ws.onmessage = e => { if (e.data instanceof ArrayBuffer) feed(new Uint8Array(e.data)); };
      ws.onerror = () => { try { ws.close(); } catch (e) {} };
      ws.onclose = () => {
        const was = ok; ok = false; ws = null; buf = new Uint8Array(0);
        clearInterval(ping);
        if (was) o.onState?.(false);
        retry();
      };
    }
    function retry() { setTimeout(open, Math.min(15000, 800 * 2 ** tries++) + Math.random() * 600); }
    function feed(chunk) {
      const b = new Uint8Array(buf.length + chunk.length); b.set(buf); b.set(chunk, buf.length); buf = b;
      while (buf.length >= 2) {
        let len = 0, mul = 1, i = 1, byte;
        do {
          if (i >= buf.length) return;
          byte = buf[i++]; len += (byte & 127) * mul; mul *= 128;
        } while (byte & 128 && i < 5);
        if (buf.length < i + len) return;
        handle(buf[0], buf.subarray(i, i + len));
        buf = buf.slice(i + len);
      }
    }
    function handle(h, p) {
      const type = h >> 4;
      if (type === 2) {                       // CONNACK
        if (p[1] !== 0) { try { ws.close(); } catch (e) {} return; }
        ok = true; tries = 0;
        topics.forEach(sub);
        while (queue.length) send(queue.shift());
        clearInterval(ping); ping = setInterval(() => send(new Uint8Array([0xC0, 0])), 25000);
        o.onState?.(true);
      } else if (type === 3) {                // PUBLISH
        const qos = h >> 1 & 3, tl = p[0] << 8 | p[1];
        const topic = dec.decode(p.subarray(2, 2 + tl));
        const body = dec.decode(p.subarray(2 + tl + (qos ? 2 : 0)));
        try { o.onMessage?.(topic, body); } catch (e) { console.error(e); }
      }
    }
    open();
    return {
      url,
      get ok() { return ok; },
      publish(t, s, retain) {
        const b = publishPkt(t, s, retain);
        if (ok) send(b); else { queue.push(b); if (queue.length > 20) queue.shift(); }
      },
      subscribe(t) { if (!topics.has(t)) { topics.add(t); sub(t); } },
      unsubscribe(t) { if (topics.delete(t) && ok) send(pkt(0xA2, [...u16(nextId()), ...str(t)])); }
    };
  }
  return { connect };
})();

const LIVE_NS = 'dengi-urok-v1';
const LIVE_BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
