// ============================================================
//  auth.js — Login / Signup system using Supabase
//
//  Ye file kya karti hai:
//  - Supabase se connect karti hai (tumhari project ki keys)
//  - User ko Sign In / Sign Up karati hai
//  - Login hone ke baad app dikhati hai
//  - Sign Out karne par wapas login screen dikhati hai
// ============================================================

// --- Tumhari Supabase project ki details ---
const SUPABASE_URL = 'https://ebyuqqndlghqecujcibb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mTCtLo1rHWIE0SCBRW-lYA__ROA5vz_';

// Supabase client banao — ye humara "connection" hai Supabase se
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Konsa tab selected hai: 'signin' ya 'signup' ---
let currentTab = 'signin';

// ── Tab switch karna (Sign In <-> New Account) ──────────────
function switchTab(tab) {
  currentTab = tab;

  // Dono tabs ka style reset karo
  document.getElementById('tabSignIn').classList.remove('active');
  document.getElementById('tabSignUp').classList.remove('active');

  // Selected tab ko active karo
  if (tab === 'signin') {
    document.getElementById('tabSignIn').classList.add('active');
    document.getElementById('authBtnText').textContent = 'SIGN IN';
  } else {
    document.getElementById('tabSignUp').classList.add('active');
    document.getElementById('authBtnText').textContent = 'CREATE ACCOUNT';
  }

  // Message clear karo
  showMessage('', '');
}

// ── Button click hone par Sign In ya Sign Up karo ──────────
async function handleAuth() {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;

  // Basic check: kya email aur password dala hai?
  if (!email || !password) {
    showMessage('Please enter email and password.', 'error');
    return;
  }

  if (currentTab === 'signin') {
    await doSignIn(email, password);
  } else {
    await doSignUp(email, password);
  }
}

// ── Sign In ─────────────────────────────────────────────────
async function doSignIn(email, password) {
  showMessage('Signing in...', 'info');
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // Successful — onAuthStateChange handle karega baaki
  } catch (err) {
    showMessage('❌ ' + err.message, 'error');
  }
}

// ── Sign Up ─────────────────────────────────────────────────
async function doSignUp(email, password) {
  showMessage('Creating account...', 'info');
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    showMessage('✅ Account created! You are now logged in.', 'success');
  } catch (err) {
    showMessage('❌ ' + err.message, 'error');
  }
}

// ── Sign Out ─────────────────────────────────────────────────
async function handleSignOut() {
  await supabase.auth.signOut();
  // onAuthStateChange handle karega screen switch
}

// ── Message dikhana (error / success / info) ────────────────
function showMessage(text, type) {
  const el = document.getElementById('auth-message');
  el.textContent = text;
  el.className = 'auth-message ' + type;
}

// ── Auth State Listener ──────────────────────────────────────
// Ye automatic chal ta hai jab bhi login/logout hota hai
supabase.auth.onAuthStateChange((event, session) => {
  if (session && session.user) {
    // User logged in hai — app dikhao
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-screen').style.display  = 'block';
    document.getElementById('userEmailDisplay').textContent = session.user.email;
  } else {
    // User logged out hai — login screen dikhao
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display  = 'none';
  }
});
