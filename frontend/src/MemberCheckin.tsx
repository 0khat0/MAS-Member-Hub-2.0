import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "./assets/mas-logo.png";
import { isValidUUID, getApiUrl, clearMemberData, setMemberId, getEasternTime, reconcileSession } from "./utils";
import { apiFetch } from './lib/session'
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
  const [createdAccountCode, setCreatedAccountCode] = useState<string | null>(null);
  const [createdProfileUrl, setCreatedProfileUrl] = useState<string | null>(null);
  const [checkinByName, setCheckinByName] = useState(false);
  const [familyNames, setFamilyNames] = useState<string[]>([]);
  const [isFamily, setIsFamily] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<string[]>([]); // NEW: Store family members from localStorage
  const [selectedFamilyMembers, setSelectedFamilyMembers] = useState<string[]>([]); // NEW: Track selected members for check-in
  // Track which family members are not checked in for the current period
  const [notCheckedInMembers, setNotCheckedInMembers] = useState<string[]>([]);
  const [checkinStatusLoading, setCheckinStatusLoading] = useState(false);
  const [showLoginInfo, setShowLoginInfo] = useState(false);

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

    // Check if user has account number stored (for PWA users who need to re-authenticate)
    const savedAccountNumber = localStorage.getItem('household_code');
    if (savedAccountNumber) {
      // Auto-sign in with stored account number
      setStatus("loading");
      setMessage("Signing you in automatically...");
      
      // Simulate the sign-in process with the stored account number
      setTimeout(async () => {
        try {
          const response = await apiFetch('/v1/auth/login-account', {
            method: 'POST',
            body: JSON.stringify({ accountNumber: savedAccountNumber.trim() })
          });

          if (response.ok) {
            const data = await response.json();
            
            // Store the session data
            if (data?.ownerEmail) localStorage.setItem('member_email', data.ownerEmail);
            if (data?.householdCode) localStorage.setItem('household_code', data.householdCode);
            const firstMemberId = Array.isArray(data?.members) && data.members.length > 0 ? data.members[0]?.id : null;
            if (firstMemberId) localStorage.setItem('member_id', firstMemberId);
            
            if (Array.isArray(data?.members) && data.members.length > 1) {
              localStorage.setItem('family_members', JSON.stringify(data.members.map((m: any) => m.name)));
              setStatus("success");
              setMessage("Welcome back! Redirecting to your family profile...");
              setTimeout(() => {
                window.location.href = `/profile?email=${encodeURIComponent(data.ownerEmail)}`;
              }, 1500);
            } else {
              setStatus("success");
              setMessage("Welcome back! Redirecting to your profile...");
              setTimeout(() => {
                window.location.href = firstMemberId ? `/profile?id=${firstMemberId}` : '/profile';
              }, 1500);
            }
            return;
          }
        } catch (error) {
          console.error('Auto sign-in failed:', error);
        }
        
        // If auto sign-in fails, fall back to manual entry
        localStorage.removeItem('household_code');
        setStatus("register");
        setMessage("");
      }, 1000);
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
        {/* Success State (show account code after signup) */}
        {status === "success" && (
          <motion.div
            className="w-full max-w-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="glass-card space-y-4 p-6 text-center">
              <h2 className="text-xl font-semibold text-white">You're all set</h2>
              {message && <p className="text-white/70 text-sm">{message}</p>}

              {createdAccountCode && (
                <div className="space-y-2">
                  <div className="text-white/80 text-sm">Your Account Code</div>
                  <div className="text-3xl tracking-widest font-mono text-white bg-white/10 border border-white/20 rounded-xl py-4">
                    {createdAccountCode}
                  </div>
                  <div className="flex gap-3 justify-center">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(createdAccountCode);
                          setMessage("Copied! Save this code for future sign-ins.");
                        } catch {
                          setMessage("Couldn't copy automatically—please copy the code manually.");
                        }
                      }}
                      className="bg-white/10 hover:bg-white/15 border border-white/20 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const url = createdProfileUrl || "/profile";
                        window.location.href = url;
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {!createdAccountCode && (
                <button
                  type="button"
                  onClick={() => {
                    const url = createdProfileUrl || "/profile";
                    window.location.href = url;
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Continue
                </button>
              )}
            </div>
          </motion.div>
        )}

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
                  // Validate inputs
                  if (!formName.trim()) { setStatus('error'); setMessage('Please enter member full name.'); return; }
                  if (!/^\s*\S+\s+\S+/.test(formName.trim())) { setStatus('error'); setMessage('Please enter member full name (first and last).'); return; }
                  if (!/^\S+@\S+\.\S+$/.test(formEmail.trim())) { setStatus('error'); setMessage('Please enter a valid member email.'); return; }
                  
                  setStatus('loading');
                  setMessage('');
                  
                  try {
                    // Create account - backend creates first member immediately
                    const res = await apiFetch('/v1/auth/start', {
                      method: 'POST',
                      body: JSON.stringify({ email: formEmail.trim(), name: formName.trim() })
                    })
                    
                    if (!res.ok) {
                      throw new Error('Failed to create account')
                    }
                    
                    const data = await res.json()
                    
                    if (data && data.ok) {
                      // Account created - backend already created first member
                      const firstMemberId = Array.isArray(data.members) && data.members.length > 0 ? data.members[0]?.id : null
                      
                      // Create additional family members if any
                      if (isFamily && familyNames.length > 0) {
                        const additionalNames = familyNames
                          .map(n => (n || '').trim())
                          .filter(n => n.length > 0 && /^\s*\S+\s+\S+/.test(n))
                        
                        for (const name of additionalNames) {
                          try {
                            await apiFetch('/v1/households/members', {
                              method: 'POST',
                              body: JSON.stringify({ name })
                            })
                          } catch {}
                        }
                      }
                      
                      // Store context
                      localStorage.setItem('member_email', formEmail.trim())
                      if (data.householdCode) {
                        localStorage.setItem('household_code', data.householdCode)
                      }
                      if (firstMemberId) {
                        localStorage.setItem('member_id', firstMemberId)
                      }
                      // Show the account code so the user can save it.
                      setCreatedAccountCode(data.householdCode || null)
                      const profileUrl = firstMemberId ? `/profile?id=${firstMemberId}` : `/profile?email=${encodeURIComponent(formEmail.trim())}`
                      setCreatedProfileUrl(profileUrl)
                      setStatus('success')
                      setMessage('Account created! Save your 5-character account code for future sign-ins.')
                      return;
                    }
                    
                    throw new Error('Unexpected response format')
                  } catch (error: any) {
                    setStatus('error')
                    setMessage(error.message || 'Failed to create account. Please try again.')
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