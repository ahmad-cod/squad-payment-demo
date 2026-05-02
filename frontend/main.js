console.log('%c Squad API Demo ', 'background: #fff; color: #df1255; font-size: 24px; padding: 6px 18px; border-radius: 4px;');
const API = 'http://localhost:8000';
let isRecurring = false;
let attempts = 0, verified = 0, totalNaira = 0;

// ── Toggle ───────────────────────────────────
document.getElementById('recurringToggle').addEventListener('click', function() {
  isRecurring = !isRecurring;
  this.classList.toggle('on', isRecurring);
  this.setAttribute('aria-pressed', isRecurring);
});

// ── Initiate payment ─────────────────────────
async function initiatePayment() {
  const email  = document.getElementById('email').value.trim();
  const amount = parseInt(document.getElementById('amount').value);

  if (!email || !amount || amount < 100) {
    showResult('initResult', false, { error: 'Provide a valid email and amount (min ₦100)' });
    return;
  }

  const btn = document.getElementById('payBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>  Initialising…';
  logEvent('inf', '⬆', `Initiating payment · ₦${amount.toLocaleString()} · ${email}`);

  try {
    const res = await fetch(
      `${API}/initiate-payment?amount=${amount * 100}&email=${encodeURIComponent(email)}&is_recurring=${isRecurring}`,
      { method: 'POST' }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Init failed');

    const txData  = data.data || {};
    const authUrl = txData.checkout_url || txData.authorization_url || txData.payment_url;
    const txRef   = txData.transaction_ref || txData.reference;

    attempts++;
    document.getElementById('stat-attempts').textContent = attempts;
    if (txRef) document.getElementById('txRef').value = txRef;

    showResult('initResult', true, {
      status: data.status,
      transaction_ref: txRef,
      message: data.message || 'Modal ready'
    });
    logEvent('ok', '✓', `Payment session created · ref: ${txRef || 'n/a'}`);

    // ── Launch Squad inline modal ──────────────
    if (typeof SquadPay !== 'undefined') {
      const squad = new SquadPay({
        onClose: () => logEvent('inf', '↩', 'Payment modal closed by user'),
        onLoad: () => logEvent('inf', '⚙', 'Squad checkout modal loaded'),
        onPaymentSuccess: (ref) => {
          logEvent('ok', '✓', `Payment success · ref: ${ref}`);
          document.getElementById('txRef').value = ref || txRef;
          verifyPayment(ref || txRef);
        },
        key: 'sandbox_pk_f99fd51cbeb27e3b6909b4f916d005fcb800c1d67926', // ← replace with your public key
        email,
        amount: amount * 100,
        currency_code: 'NGN',
      });
      squad.setup();
      squad.open();
    } else if (authUrl) {
      // Fallback: redirect to checkout URL
      logEvent('inf', '↗', 'Redirecting to Squad checkout page');
      window.open(authUrl, '_blank');
    } else {
      logEvent('err', '!', 'Squad.js not loaded. Open the checkout_url from result manually.');
    }

  } catch (err) {
    showResult('initResult', false, { error: err.message });
    logEvent('err', '✕', `Init error: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Launch payment modal';
  }
}

// ── Verify payment ───────────────────────────
async function verifyPayment(refOverride) {
  const ref = refOverride || document.getElementById('txRef').value.trim();
  if (!ref) {
    showResult('verifyResult', false, { error: 'Paste a transaction reference first' });
    return;
  }

  showResult('verifyResult', null, { status: 'Checking…' });
  logEvent('inf', '⬆', `Verifying · ${ref}`);

  try {
    const res  = await fetch(`${API}/verify-payment/${encodeURIComponent(ref)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Verification failed');

    verified++;
    totalNaira += parseInt(document.getElementById('amount').value || 0);
    document.getElementById('stat-verified').textContent = verified;
    document.getElementById('stat-total').textContent = '₦' + totalNaira.toLocaleString();

    showResult('verifyResult', true, data);
    logEvent('ok', '✓', `Transaction verified as paid · ${ref}`);
  } catch (err) {
    showResult('verifyResult', false, { error: err.message });
    logEvent('err', '✕', `Verification failed: ${err.message}`);
  }
}

// ── Helpers ──────────────────────────────────
function showResult(id, ok, obj) {
  const el = document.getElementById(id);
  el.className = 'result-box visible' + (ok === false ? ' error' : '');
  el.innerHTML = Object.entries(obj).map(([k, v]) =>
    `<span class="result-key">${k}:</span>  ${JSON.stringify(v)}`
  ).join('<br>');
}

function logEvent(type, icon, text) {
  const container = document.getElementById('logContainer');
  const empty     = document.getElementById('logEmpty');
  if (empty) empty.remove();

  const time = new Date().toLocaleTimeString();
  const div  = document.createElement('div');
  div.className = 'log-event';
  div.innerHTML = `
    <div class="log-icon ${type === 'ok' ? 'ok' : type === 'err' ? 'err' : 'inf'}" 
          style="font-size:12px;color:${type==='ok'?'var(--green)':type==='err'?'var(--red)':'var(--amber)'}">
      ${icon}
    </div>
    <div class="log-body">
      <div class="log-title">${text}</div>
      <div class="log-meta">${time}</div>
    </div>`;
  container.prepend(div);
}

function clearLog() {
  document.getElementById('logContainer').innerHTML =
    '<div class="log-empty" id="logEmpty">No events yet — initiate a payment above</div>';
}
