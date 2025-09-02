import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "./assets/mas-logo.png";
import { isValidUUID, getApiUrl, clearMemberData, setMemberId, getEasternTime, reconcileSession } from "./utils";
import AuthOTP from "./components/AuthOTP";
import { apiFetch, bootstrapSession } from './lib/session'
import { afterOtpVerified } from './lib/afterOtpVerified'
import { handleNameInputChange } from './utils/nameUtils';

function getDailyMuayThaiMessage() {
  const messages = [
    "Go smash those pads!",
    "Unleash your inner warrior!",
    "Keep your guard up and your spirit higher!",
    "Every round makes you stronger!",
    "Train hard, fight easy!",
    "Respect. Discipline. Power.",
    "Push your limits today!",
    "Channel your energy into every strike!",
    "Stay sharp, stay humble!",
    "Victory is earned in the gym!",
    "Let your kicks fly!",
    "Muay Thai: Art of Eight Limbs!",
    "Breathe, focus, conquer!",
    "You are your only competition!",
    "Make every session count!"
  ];
  // Use the day of the year to pick a message (Eastern time)
  const now = getEasternTime();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  return messages[dayOfYear % messages.length];
}

function MemberCheckin() {
  const [memberEmail, setMemberEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "register" | "signin" | "success" | "error">("loading");
  const [message, setMessage] = useState<string>("");
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [checkinByName, setCheckinByName] = useState(false);
  const [familyNames, setFamilyNames] = useState<string[]>([]);
  const [isFamily, setIsFamily] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<string[]>([]); // NEW: Store family members from localStorage
  const [selectedFamilyMembers, setSelectedFamilyMembers] = useState<string[]>([]); // NEW: Track selected members for check-in
  // Track which family members are not checked in for the current period
  const [notCheckedInMembers, setNotCheckedInMembers] = useState<string[]>([]);
  const [checkinStatusLoading, setCheckinStatusLoading] = useState(false);
  const [showLoginInfo, setShowLoginInfo] = useState(false);
  // OTP state
  const [otpPendingId, setOtpPendingId] = useState<string | null>(null);
  const [otpEmailMasked, setOtpEmailMasked] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  
  // Form state persistence for OTP cancellation
  const [formState, setFormState] = useState({
    email: '',
    name: '',
    familyNames: [] as string[],
    isFamily: false
  });

  // Unified error handling function
  const handleError = (errorMessage: string) => {
    setStatus("error");
    setMessage(errorMessage);
    // Clear any previous messages to prevent duplicates
    setTimeout(() => {
      if (status === "error" && message === errorMessage) {
        setMessage("");
      }
    }, 5000); // Auto-clear after 5 seconds
  };

  // Clear error function
  const clearError = () => {
    setStatus("register");
    setMessage("");
  };

  // Helper to handle name changes
  const handleFamilyNameChange = (idx: number, value: string) => {
    setFamilyNames(names => names.map((n, i) => i === idx ? value : n));
  };
  const addFamilyMember = () => setFamilyNames(names => [...names, ""]);
  const removeFamilyMember = (idx: number) => setFamilyNames(names => names.filter((_, i) => i !== idx));

  // Save form state before starting OTP
  const saveFormState = () => {
    setFormState({
      email: formEmail,
      name: formName,
      familyNames: [...familyNames],
      isFamily
    });
  };

  // Restore form state after OTP cancellation
  const restoreFormState = () => {
    setFormEmail(formState.email);
    setFormName(formState.name);
    setFamilyNames([...formState.familyNames]);
    setIsFamily(formState.isFamily);
  };

  // On load, check if user is already logged in
  useEffect(() => {
    const savedEmail = localStorage.getItem("member_email");
    const savedMemberId = localStorage.getItem("member_id");
    const savedFamilyMembers = localStorage.getItem("family_members");

    // Validate saved member_id if it exists
    if (savedMemberId && !isValidUUID(savedMemberId)) {
      localStorage.removeItem("member_id");
    }

    if (savedEmail) {
      setMemberEmail(savedEmail);

      // Check if this is a family
      if (savedFamilyMembers) {
        try {
          const members = JSON.parse(savedFamilyMembers);
          setFamilyMembers(members);
          if (members.length > 1) {
            // Family - just redirect to profile
            setStatus("success");
            setMessage("Welcome back! Redirecting to your family profile...");
            setTimeout(() => {
              window.location.href = `/profile?email=${encodeURIComponent(savedEmail)}`;
            }, 1500);
            return;
          }
        } catch (e) {
          console.error("Error parsing family members:", e);
          localStorage.removeItem("family_members");
        }
      }

      // Single member - just redirect to profile
      setStatus("success");
      setMessage("Welcome back! Redirecting to your profile...");
      setTimeout(() => {
        window.location.href = `/profile?id=${savedMemberId}`;
      }, 1500);
      return;
    }

    // Not logged in - show registration form
    setStatus("register");
    setMessage("");
  }, []);





  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-black via-gray-900 to-red-950 font-poppins relative overflow-hidden">
      {/* Animated background blobs */}
      <motion.div 
        className="floating-background bg-blob-1"
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, 90, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear"
        }}
      />
      <motion.div 
        className="floating-background bg-blob-2"
        animate={{
          scale: [1.2, 1, 1.2],
          rotate: [90, 0, 90],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear"
        }}
      />
      {/* Unified Main Content, no extra min-h-screen, no overflow-x-hidden, no extra wrappers */}
      <div className="flex flex-col items-center justify-center w-full min-h-screen px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6">


        {/* OTP modal only after Create account */}
        {otpPendingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-lg bg-gray-900 border border-gray-700 p-5 text-white shadow-xl">
              <h2 className="sr-only">Enter the code</h2>
              <AuthOTP
                pendingId={otpPendingId}
                emailMasked={otpEmailMasked}
                rawEmail={otpEmail}
                onBack={() => {
                  setOtpPendingId(null)
                  restoreFormState()
                  setStatus('register')
                }}
                onCancel={() => {
                  setOtpPendingId(null)
                  restoreFormState()
                  setStatus('register')
                }}
                onVerified={async (verifyPayload: any) => {
                  const sessionToken: string | undefined = verifyPayload?.session_token
                  try {
                    console.log('OTP verified, starting member creation...')
                    // Brief pause so iOS can persist the cookie
                    await new Promise(resolve => setTimeout(resolve, 600))

                    const names = (isFamily ? [formName, ...familyNames] : [formName])
                      .map(n => (n || '').trim())
                      .filter(n => n.length > 0)

                    let firstId: string | null = null

                    // Attempt member creation using cookie first
                    for (const name of names) {
                      try {
                        const res = await apiFetch('/v1/households/members', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: name.trim() })
                        })
                        if (res.ok) {
                          const m = await res.json()
                          if (!firstId) firstId = m?.id ?? null
                        }
                      } catch {}
                    }

                    // If no member created and we have a session token, try again with Bearer token (cookie race workaround)
                    if (!firstId && sessionToken) {
                      for (const name of names) {
                        try {
                          const res = await apiFetch('/v1/households/members', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                            body: JSON.stringify({ name: name.trim() })
                          })
                          if (res.ok) {
                            const m = await res.json()
                            if (!firstId) firstId = m?.id ?? null
                          }
                        } catch {}
                      }
                    }

                    // Persist basic context
                    if (otpEmail) localStorage.setItem('member_email', otpEmail)
                    // Store household code for account number display
                    if (verifyPayload?.householdCode) {
                      localStorage.setItem('household_code', verifyPayload.householdCode)
                    }
                    // Add this line to mark recent authentication
                    localStorage.setItem('last_auth_time', Date.now().toString())
                    if (!firstId) {
                      // Try to read household members (cookie first, then token)
                      let me = await apiFetch('/v1/households/me').catch(() => null)
                      if ((!me || !me.ok) && sessionToken) {
                        me = await apiFetch('/v1/households/me', { headers: { 'Authorization': `Bearer ${sessionToken}` } }).catch(() => null) as any
                      }
                      if (me && me.ok) {
                        const data = await me.json()
                        firstId = data?.members?.[0]?.id ?? null
                      }
                    }
                    if (firstId) localStorage.setItem('member_id', firstId)

                    // Confirm session via probe with small retries
                    let sessionOk = false
                    for (let i = 0; i < 3 && !sessionOk; i++) {
                      try {
                        let probe = await apiFetch('/v1/auth/session')
                        if (!probe.ok && sessionToken) {
                          probe = await apiFetch('/v1/auth/session', { headers: { 'Authorization': `Bearer ${sessionToken}` } })
                        }
                        sessionOk = probe.ok
                        if (!sessionOk) await new Promise(r => setTimeout(r, 300 * (i + 1)))
                      } catch {
                        await new Promise(r => setTimeout(r, 300 * (i + 1)))
                      }
                    }

                    // Reconcile session to prevent cross-contamination
                    try {
                      const reconciled = await reconcileSession()
                      if (reconciled) {
                        console.log('Session reconciled:', reconciled)
                      }
                    } catch (error) {
                      console.warn('Session reconciliation failed:', error)
                    }

                    if (!firstId) {
                      // Show error instead of infinite spinner
                      setOtpPendingId(null)
                      setStatus('error')
                      setMessage('Could not create your profile. Please try again or reload the app.')
                      return
                    }

                    const profileUrl = firstId ? `/profile?id=${firstId}` : `/profile?email=${encodeURIComponent(otpEmail)}`
                    // Use afterOtpVerified to handle iOS PWA cookie race condition
                    await afterOtpVerified(() => {
                      window.location.replace(profileUrl)
                    })
                  } catch (error) {
                    console.error('OTP verification error:', error)
                    setOtpPendingId(null)
                    setStatus('error')
                    setMessage('We could not complete registration. Please try again or reload the app.')
                  }
                }}
              />
            </div>
          </div>
        )}
        <motion.div
          className="flex flex-row items-center justify-center w-full mb-4 gap-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="bg-white rounded-2xl shadow-lg p-2 flex items-center justify-center"
               style={{ width: 120, height: 120 }}>
            <img
              src={logo}
              alt="MAS Academy Logo"
              className="object-contain h-full w-full"
              style={{ maxHeight: 110, maxWidth: 110 }}
            />
          </div>
          <div className="flex flex-col items-start justify-center w-full max-w-xs">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-lg"
                style={{ textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>
              MAS Academy Member Hub
            </h1>
            <div className="h-2 rounded-full animated-accent-bar shadow-md mt-2 w-full" />
          </div>
        </motion.div>
        {/* FAMILY PROFILE ACCESS */}
        {status === "register" && familyMembers.length > 1 && (
          <motion.div
            className="w-full max-w-md space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="glass-card space-y-6 p-6">
              <div className="text-center">
                <h3 className="text-xl font-semibold text-white mb-2">Family Home Page</h3>
                <p className="text-white/70 mb-4">Select which family members are here today:</p>
              </div>
              <div className="space-y-3">
                {familyMembers.map((memberName) => (
                  <div key={memberName} className="flex items-center space-x-3 p-3 rounded-lg bg-white/5">
                    <span className="text-white font-medium">{memberName}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={async () => {
                  try {
                    const API_URL = getApiUrl();
                    const res = await fetch(`${API_URL}/family/checkin`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        email: memberEmail,
                        member_names: selectedFamilyMembers,
                      }),
                    });

                    if (res.ok) {
                      await res.json(); // Remove unused variable
                      setSelectedFamilyMembers([]);
                      
                      // Trigger admin dashboard refresh
                      if ((window as any).refreshAdminDashboard) {
                        (window as any).refreshAdminDashboard();
                      }
                    } else {
                      const err = await res.json();
                      setStatus("error");
                      setMessage(err.detail || "Family home page access failed.");
                    }
                  } catch {
                    setStatus("error");
                    setMessage("Network error. Please try again.");
                  }
                }}
                disabled={selectedFamilyMembers.length === 0}
                className="w-full bg-gradient-to-r from-red-700 via-red-500 to-pink-500 text-white py-3 px-6 rounded-lg font-semibold hover:from-pink-600 hover:to-red-700 transition-all duration-300 shadow-lg hover:shadow-black/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Access Home Page for Selected Members ({selectedFamilyMembers.length})
              </button>
            </div>
          </motion.div>
        )}

                 {/* NEW USER STATE: No recognition - show registration form + modern toggle */}
         {status === "register" && familyMembers.length === 0 && (
           <>
             {/* Modern toggle at bottom */}
             <motion.div
               className="w-full max-w-md mt-4"
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.3 }}
             >
                               <div className="flex items-center justify-center space-x-4 text-sm">
                  <button
                    type="button"
                    className={`px-4 py-2 rounded-full font-medium transition-all duration-200 ${
                      !checkinByName 
                        ? 'bg-white/10 text-white border border-white/20' 
                        : 'text-white/60 hover:text-white'
                    }`}
                    onClick={() => setCheckinByName(false)}
                  >
                    Create Account
                  </button>
                  <span className="text-white/60">or</span>
                  <button
                    type="button"
                    className={`px-4 py-2 rounded-full font-medium transition-all duration-200 ${
                      checkinByName 
                        ? 'bg-white/10 text-white border border-white/20' 
                        : 'text-white/60 hover:text-white'
                    }`}
                    onClick={() => setCheckinByName(true)}
                  >
                    Log In
                  </button>
                </div>
             </motion.div>

            {/* Show registration form or account code sign-in form */}
            {!checkinByName ? (
              <motion.form
                className="w-full max-w-md space-y-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                onSubmit={async (e) => {
                  e.preventDefault();
                  // Start OTP; create members after verify
                  if (!formName.trim()) { setStatus('error'); setMessage('Please enter member full name.'); return; }
                  if (!/^\s*\S+\s+\S+/.test(formName.trim())) { setStatus('error'); setMessage('Please enter member full name (first and last).'); return; }
                  if (!/^\S+@\S+\.\S+$/.test(formEmail.trim())) { setStatus('error'); setMessage('Please enter a valid member email.'); return; }
                  try {
                    // Save form state before starting OTP
                    saveFormState();
                    
                    const res = await apiFetch('/v1/auth/start', { method: 'POST', body: JSON.stringify({ email: formEmail.trim() }) })
                    if (!res.ok) throw new Error('start failed')
                    const data = await res.json()
                    setOtpPendingId(data.pendingId); setOtpEmailMasked(data.to); setOtpEmail(formEmail.trim())
                    return; // Stop here; rest of legacy flow runs after OTP verification
                  } catch { setStatus('error'); setMessage('Failed to start verification. Please try again.'); }
                  
                  // FALLBACK: Original complex logic for existing users
                  const allNames = [formName, ...familyNames];
                  console.log("🔍 Starting returning user flow with names:", allNames);
                  
                  for (const name of allNames) {
                    if (!/^\s*\S+\s+\S+/.test(name.trim())) {
                      setMessage("Please enter member full name (first and last) for each member.");
                      return;
                    }
                  }
                  setStatus("loading");
                  setMessage("");
                  const API_URL = getApiUrl();
                  
                  try {
                    // STEP 1: Check which names exist and which don't
                    const existingMembers = [];
                    const newMembers = [];
                    let familyEmail = null;
                    
                    console.log("🔍 STEP 1: Checking each name...");
                    for (const name of allNames) {
                      console.log(`🔍 Checking name: "${name.trim()}"`);
                      try {
                    const lookupRes = await fetch(`${API_URL}/member/lookup-by-name`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ name: name.trim() }),
                        });
                        if (lookupRes.ok) {
                          const memberData = await lookupRes.json();
                          console.log(`✅ Found existing member:`, memberData);
                          existingMembers.push({
                            name: name.trim(),
                            email: memberData.email,
                            id: memberData.id
                          });
                          // Use the first found member's email as the family email
                          if (!familyEmail) {
                            familyEmail = memberData.email;
                            console.log(`📧 Set family email to: ${familyEmail}`);
                          }
                        } else {
                          console.log(`❌ Name not found: "${name.trim()}" - adding to new members`);
                          newMembers.push(name.trim());
                        }
                      } catch (error) {
                        console.log(`❌ Error looking up "${name.trim()}":`, error);
                        newMembers.push(name.trim());
                      }
                    }
                    
                    console.log("🔍 STEP 1 RESULTS:");
                    console.log("- Existing members:", existingMembers);
                    console.log("- New members:", newMembers);
                    console.log("- Family email:", familyEmail);
                    
                    // If no existing members found, show error
                    if (existingMembers.length === 0) {
                      console.log("❌ No existing members found, redirecting to register");
                      setStatus("register");
                      setFormName("");
                      setFamilyNames([]);
                      setMessage("No existing members found with these names. Please register instead.");
                      return;
                    }
                    
                    // STEP 2: Add new members to the existing family (if any)
                    if (newMembers.length > 0 && familyEmail) {
                      console.log("🔍 STEP 2: Adding new members to family...");
                      console.log(`📝 Adding ${newMembers.length} new members to email: ${familyEmail}`);
                      try {
                        const addRes = await fetch(`${API_URL}/family/add-members`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            email: familyEmail,
                            new_members: newMembers,
                          }),
                        });
                        if (addRes.ok) {
                          const addResult = await addRes.json();
                          console.log("✅ Successfully added new members:", addResult);
                        } else {
                          const err = await addRes.json();
                          console.error("❌ Failed to add new members:", err.detail);
                        }
                      } catch (error) {
                        console.error("❌ Error adding new members:", error);
                      }
                    } else {
                      console.log("🔍 STEP 2: Skipped - no new members to add");
                    }
                    
                    // STEP 3: Get updated family info and set up localStorage
                    console.log("🔍 STEP 3: Getting updated family info...");
                    try {
                      const familyRes = await fetch(`${API_URL}/family/members/${encodeURIComponent(familyEmail)}`);
                      if (familyRes.ok) {
                        const familyData = await familyRes.json();
                        const familyMemberNames = familyData.map((m: any) => m.name);
                        console.log("✅ Updated family members:", familyMemberNames);
                        
                        // Set up localStorage
                          localStorage.setItem("family_members", JSON.stringify(familyMemberNames));
                        localStorage.setItem("member_email", familyEmail);
                        localStorage.setItem("member_id", existingMembers[0].id);
                        setMemberEmail(familyEmail);
                          setFamilyMembers(familyMemberNames);
                        console.log("✅ localStorage updated");
                        
                        // For registration flow, just redirect to profile (no check-in)
                        if (familyMemberNames.length > 1) {
                          // Family - redirect to family profile using email
                          window.location.href = `/profile?email=${encodeURIComponent(familyEmail)}`;
                          return;
                        } else {
                          // Single member - redirect to profile
                          window.location.href = `/profile?id=${existingMembers[0].id}`;
                          return;
                        }
                    } else {
                        console.error("❌ Failed to load family information");
                        setStatus("error");
                        setMessage("Failed to load family information.");
                      }
                    } catch (error) {
                      console.error("❌ Network error loading family information:", error);
                      setStatus("error");
                      setMessage("Network error loading family information.");
                    }
                  } catch (error) {
                    console.error("❌ General network error:", error);
                    setStatus("error");
                    setMessage("Network error. Please try again.");
                  }
                }}
              >
                                 <div className="glass-card space-y-6 p-6">
                   {/* Modern Family Toggle */}
                   <motion.div className="flex justify-center mb-6">
                     <div className="bg-white/5 rounded-full p-1 flex">
                       <button
                         type="button"
                         onClick={() => setIsFamily(false)}
                         className={`px-6 py-2 rounded-full font-medium transition-all duration-200 ${
                           !isFamily 
                             ? 'bg-white/20 text-white shadow-sm' 
                             : 'text-white/60 hover:text-white'
                         }`}
                       >
                         Individual
                       </button>
                       <button
                         type="button"
                         onClick={() => setIsFamily(true)}
                         className={`px-6 py-2 rounded-full font-medium transition-all duration-200 ${
                           isFamily 
                             ? 'bg-white/20 text-white shadow-sm' 
                             : 'text-white/60 hover:text-white'
                         }`}
                       >
                         Family
                       </button>
                     </div>
                   </motion.div>
                  
                  <motion.div className="space-y-2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                    <label className="block text-sm font-medium text-white/80 mb-2">Full Name</label>
                    <input 
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all duration-200" 
                      placeholder="Enter member full name" 
                      type="text" 
                      value={formName} 
                      onChange={e => handleNameInputChange(e, setFormName)} 
                      required 
                    />
                  </motion.div>
                  
                                     {/* Family member fields - only show if family mode is active */}
                   {isFamily && familyNames.map((name, idx) => (
                     <motion.div key={idx} className="flex items-center gap-3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + idx * 0.1 }}>
                                              <input 
                         className="min-w-0 flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all duration-200" 
                         placeholder="Enter member full name" 
                         type="text" 
                         value={name} 
                         onChange={e => handleNameInputChange(e, (value) => handleFamilyNameChange(idx, value))} 
                         required 
                       />
                       <button 
                         type="button" 
                         className="bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg transition-all duration-200 hover:scale-110 shadow-lg" 
                         onClick={() => removeFamilyMember(idx)} 
                         aria-label="Remove family member"
                         title="Remove family member"
                       >
                         ×
                       </button>
                     </motion.div>
                   ))}
                  
                  {isFamily && (
                    <motion.button type="button" className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition-colors duration-200" onClick={addFamilyMember} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                      + Add Family Member
                    </motion.button>
                  )}
                  
                  <motion.div 
                    className="space-y-2"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <label className="block text-sm font-medium text-white/80 mb-2">Member Email</label>
                    <input
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all duration-200"
                      placeholder="Enter member email"
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      required
                    />
                  </motion.div>
                                     <motion.button
                     className="w-full bg-gradient-to-r from-red-600 to-red-500 text-white py-4 px-6 rounded-xl font-semibold hover:from-red-500 hover:to-red-400 transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-red-500/20"
                     whileHover={{ scale: 1.02 }}
                     whileTap={{ scale: 0.98 }}
                     type="submit"
                   >
                     {isFamily ? 'Create Account' : 'Create Account'}
                   </motion.button>
                </div>
              </motion.form>
            ) : (
              <motion.form
                className="w-full max-w-md space-y-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!formName.trim()) {
                    handleError("Please enter your account code.");
                    return;
                  }
                  
                  setStatus("loading");
                  setMessage("");
                  
                  try {
                    // Direct login with account code (no OTP)
                    const res = await apiFetch('/v1/auth/login-account', {
                      method: 'POST',
                      body: JSON.stringify({ accountNumber: formName.trim() })
                    });
                    
                    if (!res.ok) {
                      const errorData = await res.json();
                      handleError(errorData.detail || "Invalid account code. Please try again.");
                      return;
                    }
                    
                    const data = await res.json();
                    
                    // Store household information
                    if (data.householdCode) {
                      localStorage.setItem('household_code', data.householdCode);
                    }
                    if (data.ownerEmail) {
                      localStorage.setItem('member_email', data.ownerEmail);
                    }
                    if (data.members && data.members.length > 0) {
                      localStorage.setItem('member_id', data.members[0].id);
                      if (data.members.length > 1) {
                        localStorage.setItem('family_members', JSON.stringify(data.members.map((m: any) => m.name)));
                      }
                    }
                    
                    // Mark recent authentication
                    localStorage.setItem('last_auth_time', Date.now().toString());
                    
                    // Redirect to profile
                    if (data.members && data.members.length > 1) {
                      // Family - redirect to family profile
                      window.location.href = `/profile?email=${encodeURIComponent(data.ownerEmail)}`;
                    } else if (data.members && data.members.length === 1) {
                      // Single member - redirect to profile
                      window.location.href = `/profile?id=${data.members[0].id}`;
                    } else {
                      // No members yet - redirect to profile
                      window.location.href = '/profile';
                    }
                    
                  } catch (error) {
                    console.error("Login error:", error);
                    handleError("Network error. Please try again.");
                  }
                }}
              >
                <div className="glass-card space-y-4 p-4 sm:p-6">
                  <motion.div className="space-y-2 sm:space-y-3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                    <label className="block text-sm sm:text-base font-medium text-white/90 mb-2 sm:mb-3">Account Code</label>
                    <input 
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 sm:px-5 sm:py-4 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 text-center tracking-wider font-mono text-lg sm:text-xl placeholder:text-sm sm:placeholder:text-base" 
                      placeholder="ABC12" 
                      type="text" 
                      value={formName} 
                      onChange={(e) => {
                        const value = e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 5);
                        setFormName(value);
                      }}
                      maxLength={5}
                      required 
                    />
                    <p className="text-xs sm:text-sm text-white/60 text-center">Enter your 5-character account code</p>
                  </motion.div>
                  <motion.button
                    className="w-full bg-gradient-to-r from-red-600 to-red-500 text-white py-3 sm:py-4 px-4 sm:px-6 rounded-xl font-semibold hover:from-red-500 hover:to-red-400 transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-red-500/20 text-sm sm:text-base"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                  >
                    Log In
                  </motion.button>
                </div>
              </motion.form>
            )}
          </>
        )}

        {/* Loading State */}
        <AnimatePresence>
          {status === "loading" && (
            <motion.div 
              className="w-full max-w-md space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div 
                className="glass-card flex flex-col items-center p-6"
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-red-500 mb-4"></div>
                <p className="text-xl font-medium text-white/90">
                  {"Processing..."}
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error State */}
        <AnimatePresence>
          {status === "error" && (
            <motion.div
              className="w-full max-w-md"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="glass-card p-6 text-center">
                <div className="text-red-400 text-2xl mb-2">⚠️</div>
                <h3 className="text-lg font-semibold text-white mb-2">Something went wrong</h3>
                <p className="text-white/70 mb-4">{message}</p>
                <button
                  onClick={() => {
                    setStatus("register");
                    setMessage("");
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Member Stats (moved to Profile page) */}
        
        {/* Login Info Modal */}
        <AnimatePresence>
          {showLoginInfo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowLoginInfo(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-gray-900 rounded-xl shadow-xl w-full max-w-md border border-gray-700"
                onClick={e => e.stopPropagation()}
              >
                <div className="p-6 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">Login Help</h2>
                    <button
                      onClick={() => setShowLoginInfo(false)}
                      className="text-white/60 hover:text-white transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-white font-medium mb-2">🔐 Login with Account Code</h3>
                      <p className="text-white/70 text-sm">
                        Enter your 5-character account code to access your membership.
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="text-white font-medium mb-2">
                <svg className="inline w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Create New Account
              </h3>
                      <p className="text-white/70 text-sm">
                        If you're new, create an account with your name and email to get started.
                      </p>
                    </div>
                    
                    <div className="bg-blue-900/30 border border-blue-600/50 rounded-lg p-3">
                      <p className="text-blue-300 text-sm">
                        💡 <strong>Tip:</strong> Your account code is a 5-character code containing letters and numbers (excluding I, O, 0, 1).
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default MemberCheckin; 