import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "./assets/mas-logo.png";
import { isValidUUID, getApiUrl, clearMemberData, setMemberId, getEasternTime } from "./utils";

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
          window.location.href = `/profile?email=${encodeURIComponent(savedEmail)}`;
        }, 1500);
      } else {
        setStatus("register");
      }
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
      <div className="flex flex-col items-center justify-center w-full min-h-screen px-4 py-8 space-y-6">
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
                <h3 className="text-xl font-semibold text-white mb-2">👨‍👩‍👧‍👦 Family Home Page</h3>
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
                    Register
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

            {/* Show registration form or check-in by name form */}
            {!checkinByName ? (
              <motion.form
                className="w-full max-w-md space-y-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                onSubmit={async (e) => {
                  e.preventDefault();
                  
                  // SIMPLE REGISTRATION OVERRIDE: If email is provided, register user
                  if (formEmail && formEmail.trim()) {
                    console.log("🔍 Starting REGISTRATION flow");
                    
                    // Validate inputs
                    if (!formName.trim()) {
                      setStatus("error");
                      setMessage("Please enter your name.");
                      return;
                    }

                    if (!/^\s*\S+\s+\S+/.test(formName.trim())) {
                      setStatus("error");
                      setMessage("Please enter your full name (first and last).");
                      return;
                    }

                    setStatus("loading");
                    setMessage("");
                    const API_URL = getApiUrl();

                    try {
                      // Check if this is a family registration
                      if (isFamily && familyNames.length > 0) {
                        // Family registration
                        const allMembers = [formName.trim(), ...familyNames.filter(n => n.trim())];
                        const response = await fetch(`${API_URL}/family/register`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            email: formEmail.trim(),
                            members: allMembers.map(name => ({ name }))
                          }),
                        });

                        if (response.ok) {
                          const result = await response.json();
                          console.log("✅ Family registration successful:", result);
                          
                          // Store family data and redirect to family profile
                          localStorage.setItem("member_email", formEmail.trim());
                          const memberNames = result.members.map((m: any) => m.name);
                          localStorage.setItem("family_members", JSON.stringify(memberNames));
                          
                          // Redirect to family profile page
                          window.location.href = `/profile?email=${encodeURIComponent(formEmail.trim())}`;
                          return;
                        } else {
                          const error = await response.json();
                          setStatus("error");
                          setMessage(error.detail || "Family registration failed. Please try again.");
                          return;
                        }
                      } else {
                        // Individual registration
                        const response = await fetch(`${API_URL}/member/register-only`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            name: formName.trim(),
                            email: formEmail.trim(),
                          }),
                        });

                        if (response.ok) {
                          const result = await response.json();
                          console.log("✅ Registration successful:", result);
                          
                          // Store member data and redirect to profile
                          localStorage.setItem("member_email", formEmail.trim());
                          localStorage.setItem("member_id", result.member.id);
                          localStorage.removeItem("family_members");
                          
                          // Redirect to profile page
                          window.location.href = `/profile?id=${result.member.id}`;
                          return;
                        } else {
                          const error = await response.json();
                          setStatus("error");
                          setMessage(error.detail || "Registration failed. Please try again.");
                          return;
                        }
                      }
                    } catch (error) {
                      console.error("❌ Registration error:", error);
                      setStatus("error");
                      setMessage("Network error. Please try again.");
                      return;
                    }
                  }
                  
                  // FALLBACK: Original complex logic for existing users
                  const allNames = [formName, ...familyNames];
                  console.log("🔍 Starting returning user flow with names:", allNames);
                  
                  for (const name of allNames) {
                    if (!/^\s*\S+\s+\S+/.test(name.trim())) {
                      setMessage("Please enter a full name (first and last) for each member.");
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
                         👨‍👩‍👧‍👦 Family
                       </button>
                     </div>
                   </motion.div>
                  
                  <motion.div className="space-y-2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                    <label className="block text-sm font-medium text-white/80 mb-2">Full Name</label>
                    <input 
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all duration-200" 
                      placeholder="Enter your full name" 
                      type="text" 
                      value={formName} 
                      onChange={e => setFormName(e.target.value)} 
                      required 
                    />
                  </motion.div>
                  
                                     {/* Family member fields - only show if family mode is active */}
                   {isFamily && familyNames.map((name, idx) => (
                     <motion.div key={idx} className="flex items-center gap-3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + idx * 0.1 }}>
                       <input 
                         className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all duration-200" 
                         placeholder="Enter family member's full name" 
                         type="text" 
                         value={name} 
                         onChange={e => handleFamilyNameChange(idx, e.target.value)} 
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
                    <label className="block text-sm font-medium text-white/80 mb-2">Email Address</label>
                    <input
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all duration-200"
                      placeholder="Enter your email"
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
                     {isFamily ? 'Register Family' : 'Create Account'}
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
                  // Validate all names
                  const allNames = [formName, ...familyNames];
                  console.log("🔍 Starting returning user flow with names:", allNames);
                  
                  for (const name of allNames) {
                    if (!/^\s*\S+\s+\S+/.test(name.trim())) {
                      setMessage("Please enter a full name (first and last) for each member.");
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
                        
                        // For sign-in flow, just redirect to profile (no check-in)
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
                  {message && (<div className="text-red-400 text-center font-semibold mb-2">{message}</div>)}
                  <motion.div className="space-y-2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="block text-sm font-medium text-white/80">Full Name</label>
                      <button
                        type="button"
                        onClick={() => setShowLoginInfo(true)}
                        className="w-4 h-4 rounded-full bg-white/20 text-white/70 hover:bg-white/30 hover:text-white transition-colors duration-200 flex items-center justify-center text-xs font-medium"
                        title="Login help"
                      >
                        ?
                      </button>
                    </div>
                    <input 
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all duration-200" 
                      placeholder="Enter member full name" 
                      type="text" 
                      value={formName} 
                      onChange={e => setFormName(e.target.value)} 
                      required 
                    />
                  </motion.div>
                                     {/* Family member fields */}
                   {familyNames.map((name, idx) => (
                     <div key={idx} className="flex items-center gap-3">
                       <input 
                         className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all duration-200" 
                         placeholder="Enter family member's full name" 
                         type="text" 
                         value={name} 
                         onChange={e => handleFamilyNameChange(idx, e.target.value)} 
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
                     </div>
                   ))}
                                     <motion.button
                     className="w-full bg-gradient-to-r from-red-600 to-red-500 text-white py-4 px-6 rounded-xl font-semibold hover:from-red-500 hover:to-red-400 transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-red-500/20"
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

        {/* Loading and Error States */}
        <AnimatePresence>
          {(status === "loading" || status === "error") && (
            <motion.div 
              className="w-full max-w-md space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {status === "loading" && (
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
              )}
              {status === "error" && (
                <motion.div 
                  className="glass-card bg-red-500/10 p-6 text-center"
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                >
                  <p className="text-xl font-semibold text-red-400">✗ {message}</p>
                  <button
                    onClick={() => {
                      setStatus("register");
                      setMessage("");
                    }}
                    className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Try Again
                  </button>
                </motion.div>
              )}
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
                      <h3 className="text-white font-medium mb-2">👤 For Individuals</h3>
                      <p className="text-white/70 text-sm">
                        Enter your full name as registered in the system.
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="text-white font-medium mb-2">👥 For Families</h3>
                      <p className="text-white/70 text-sm">
                        If you're part of a family membership, just enter <strong>any one name</strong> from your family to log in.
                      </p>
                    </div>
                    
                    <div className="bg-blue-900/30 border border-blue-600/50 rounded-lg p-3">
                      <p className="text-blue-300 text-sm">
                        💡 <strong>Tip:</strong> Use the exact spelling of the name as it appears in your membership.
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