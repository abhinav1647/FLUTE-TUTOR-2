const SUPABASE_URL = 'https://ebyuqqndlghqecujcibb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVieXVxcW5kbGdocWVjdWpjaWJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NzQwOTUsImV4cCI6MjA5MDM1MDA5NX0.M6ersCPR2QH0qS5Euebi5hD6i5HzaqPUOxnx1si9X9w';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentTab = 'signin';

function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tabSignIn').classList.toggle('active', tab === 'signin');
  document.getElementById('tabSignUp').classList.toggle('active', tab === 'signup');
  document.getElementById('authBtnText').textContent = tab === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT';
  setMessage('', '');
}

function setMessage(text, type) {
  const el = document.getElementById('auth-message');
  el.textContent = text;
  el.className = 'auth-message ' + type;
}

async function handleAuth() {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value.trim();

  if (!email || !password) {
    setMessage('Please enter email and password.', 'error');
    return;
  }

  setMessage('Please wait...', 'info');

  if (currentTab === 'signin') {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setMessage(error.message, 'error'); return; }
    showApp(data.user);
  } else {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { setMessage(error.message, 'error'); return; }
    setMessage('Account created! Check your email to confirm.', 'success');
  }
}

async function handleSignOut() {
  await supabase.auth.signOut();
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display  = 'none';
}

function showApp(user) {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display  = 'block';
  document.getElementById('userEmailDisplay').textContent = user.email;
}

supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) showApp(session.user);
});
```
