const SUPABASE_URL = 'https://ebyuqqndlghqecujcibb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVieXVxcW5kbGdocWVjdWpjaWJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NzQwOTUsImV4cCI6MjA5MDM1MDA5NX0.M6ersCPR2QH0qS5Euebi5hD6i5HzaqPUOxnx1si9X9w';

// Use a distinct name for the client instance to avoid clashing with the 'supabase' library object
let supabaseClient;
try {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('[Auth Debug] Supabase Client Initialized Successfully');
} catch (e) {
  console.error('[Auth Debug] Failed to initialize Supabase client:', e);
}

let currentTab = 'signin';

function switchTab(tab) {
  console.log('[Auth Debug] Switching tab to:', tab);
  currentTab = tab;
  const tabSignIn = document.getElementById('tabSignIn');
  const tabSignUp = document.getElementById('tabSignUp');
  const authBtnText = document.getElementById('authBtnText');
  
  if (tabSignIn) tabSignIn.classList.toggle('active', tab === 'signin');
  if (tabSignUp) tabSignUp.classList.toggle('active', tab === 'signup');
  if (authBtnText) {
    authBtnText.textContent = tab === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT';
  }
  setMessage('', '');
}

function setMessage(text, type) {
  const el = document.getElementById('auth-message');
  if (el) {
    el.textContent = text;
    el.className = 'auth-message ' + type;
  }
}

async function handleAuth() {
  console.log('[Auth Debug] handleAuth called for tab:', currentTab);
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  
  if (!emailInput || !passwordInput) {
    console.error('[Auth Debug] Error: Email or password input fields not found in the page.');
    return;
  }

  const email    = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    setMessage('Please enter email and password.', 'error');
    return;
  }

  if (password.length < 6) {
    setMessage('Password must be at least 6 characters.', 'error');
    return;
  }

  setMessage('Processing...', 'info');

  try {
    if (currentTab === 'signin') {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      console.log('[Auth Debug] Sign-in successful for user:', data.user.email);
    } else {
      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw error;
      console.log('[Auth Debug] Sign-up successful for user:', data.user ? data.user.email : 'Check confirmation mail');
      
      if (data.session) {
        setMessage('Welcome! Redirecting...', 'success');
      } else {
        setMessage('Account created! Please check your email to confirm.', 'success');
      }
    }
  } catch (err) {
    console.error('[Auth Debug] Auth Action Failed:', err.message);
    setMessage(err.message, 'error');
  }
}

// ─── FINAL SIGN OUT FIX ──────────────────────────────────────────
async function handleSignOut() {
  console.log('[Auth Debug] handleSignOut button clicked.');
  
  // 1. Force UI to change immediately (Better UX)
  resetToAuthScreen();
  
  try {
    // 2. Perform remote signout
    if (supabaseClient) {
      const { error } = await supabaseClient.auth.signOut();
      if (error) console.warn('[Auth Debug] Signout reported error (continuing anyway):', error.message);
      console.log('[Auth Debug] Signout successful.');
    }
  } catch (err) {
    console.error('[Auth Debug] Signout error:', err.message);
  } finally {
    // 3. Last resort: clear any lingering local storage
    localStorage.clear();
    sessionStorage.clear();
  }
}

function resetToAuthScreen() {
  const authScreen = document.getElementById('auth-screen');
  const appScreen = document.getElementById('app-screen');
  if (authScreen) authScreen.style.display = 'flex';
  if (appScreen) appScreen.style.display  = 'none';
  setMessage('You have been signed out.', 'info');
}

function showApp(user) {
  console.log('[Auth Debug] showing app screen for user:', user.email);
  const authScreen = document.getElementById('auth-screen');
  const appScreen = document.getElementById('app-screen');
  const userDisplay = document.getElementById('userEmailDisplay');
  
  if (authScreen) authScreen.style.display = 'none';
  if (appScreen) appScreen.style.display  = 'block';
  if (userDisplay && user) userDisplay.textContent = user.email;
}

// ─── OBSERVE AUTH STATE ──────────────────────────────────────────
if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('[Auth Debug] Supabase State Changed:', event);
    if (session && session.user) {
      showApp(session.user);
    } else {
      console.log('[Auth Debug] No active session found.');
      resetToAuthScreen();
    }
  });
}

// Ensure these functions are globally available for HTML onclick events
window.switchTab = switchTab;
window.handleAuth = handleAuth;
window.handleSignOut = handleSignOut;
