import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "./assets/mas-logo.png";
import { isValidUUID, getApiUrl, clearMemberData, setMemberId, getTorontoTime } from "./utils";

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
  // Use the day of the year to pick a message (Toronto time)
  const now = getTorontoTime();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  return messages[dayOfYear % messages.length];
}

function MemberCheckin() {
  const [memberEmail, setMemberEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "register" | "checking-in" | "success" | "error">("loading");
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

  // Helper to handle name changes
  const handleFamilyNameChange = (idx: number, value: string) => {
    setFamilyNames(names => names.map((n, i) => i === idx ? value : n));
  };
  const addFamilyMember = () => setFamilyNames(names => [...names, ""]);
  const removeFamilyMember = (idx: number) => setFamilyNames(names => names.filter((_, i) => i !== idx));

  // Helper to fetch family check-in status
  const fetchFamilyCheckinStatus = async (email: string) => {
    setCheckinStatusLoading(true);
    try {
      const API_URL = getApiUrl();
      const res = await fetch(`${API_URL}/family/checkin-status/${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        setNotCheckedInMembers(data.not_checked_in || []);
      } else {
        setNotCheckedInMembers([]);
      }
    } catch {
      setNotCheckedInMembers([]);
    } finally {
      setCheckinStatusLoading(false);
    }
  };

  // On load, if family, fetch check-in status
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
            // Always fetch check-in status for family
            fetchFamilyCheckinStatus(savedEmail).then(() => {
              // The notCheckedInMembers state will be set by fetchFamilyCheckinStatus
            });
            setStatus("register");
            setMessage("Select which family members are here today:");
            return;
          }
        } catch (e) {
          console.error("Error parsing family members:", e);
          localStorage.removeItem("family_members");
        }
      }

      // Single member or family with only one member - proceed with auto check-in
      setStatus("checking-in");
    } else {
      setStatus("register");
    }
  }, []);

  // After successful family check-in or registration, refresh check-in status
  useEffect(() => {
    if (status === "success" && memberEmail && familyMembers.length > 1) {
      fetchFamilyCheckinStatus(memberEmail);
    }
  }, [status]);

  useEffect(() => {
    if (status === "checking-in" && memberEmail) {
      const API_URL = getApiUrl();
      fetch(`${API_URL}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: memberEmail }),
      })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            // Only store member_id if it's a valid UUID
            if (data.member_id && isValidUUID(data.member_id)) {
              setMemberId(data.member_id);
              console.log('Set member_id after check-in (useEffect):', data.member_id);
            }
            setStatus("success");
            setMessage("Check-in successful! Welcome back.");
          } else {
            const data = await res.json();
            if (data.detail === "Member not found") {
              clearMemberData();
              setStatus("register");
              setMessage("");
            } else {
              setStatus("error");
              setMessage(data.detail || "Check-in failed.");
            }
          }
        })
        .catch(() => {
          setStatus("error");
          setMessage("Network error. Please try again.");
        });
    }
  }, [status, memberEmail]);

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
        {/* SUCCESS STATE: All family members checked in - ONLY show green message for family */}
        {status === "success" && familyMembers.length > 1 && (
          <motion.div
            className="w-full max-w-md"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="glass-card bg-gradient-to-r from-green-800 via-green-700 to-green-600 p-6 text-center">
              <p className="text-xl font-semibold text-white">✓ All family members have checked in for this period!</p>
              <p className="mt-2 text-lg text-white/90 font-medium">{getDailyMuayThaiMessage()}</p>
            </div>
          </motion.div>
        )}
        {/* SUCCESS STATE: All family members already checked in - persistent green message */}
        {status === "register" && familyMembers.length > 1 && notCheckedInMembers.length === 0 && !checkinStatusLoading && (
          <motion.div
            className="w-full max-w-md"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="glass-card bg-gradient-to-r from-green-800 via-green-700 to-green-600 p-6 text-center">
              <p className="text-xl font-semibold text-white">✓ All family members have checked in for this period!</p>
              <p className="mt-2 text-lg text-white/90 font-medium">{getDailyMuayThaiMessage()}</p>
            </div>
          </motion.div>
        )}
        {/* SUCCESS STATE: Single user after check-in - ONLY show green message for single */}
        {status === "success" && (familyMembers.length <= 1 || !familyMembers.length) && (
          <motion.div
            className="w-full max-w-md"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="glass-card bg-gradient-to-r from-green-800 via-green-700 to-green-600 p-6 text-center">
              <p className="text-xl font-semibold text-white">✓ {message || "Check-in successful! Welcome back."}</p>
              <p className="mt-2 text-lg text-white/90 font-medium">{getDailyMuayThaiMessage()}</p>
            </div>
          </motion.div>
        )}

        {/* FAMILY SELECTION STATE: Some family members not checked in - ONLY show family selection */}
        {status === "register" && familyMembers.length > 1 && notCheckedInMembers.length > 0 && !checkinStatusLoading && (
          <motion.div
            className="w-full max-w-md space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="glass-card space-y-6 p-6">
              <div className="text-center">
                <h3 className="text-xl font-semibold text-white mb-2">👨‍👩‍👧‍👦 Family Check-in</h3>
                <p className="text-white/70 mb-4">Select which family members are here today:</p>
              </div>
              <div className="space-y-3">
                {notCheckedInMembers.map((memberName) => (
                  <label key={memberName} className="flex items-center space-x-3 cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedFamilyMembers.includes(memberName)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedFamilyMembers(prev => [...prev, memberName]);
                        } else {
                          setSelectedFamilyMembers(prev => prev.filter(name => name !== memberName));
                        }
                      }}
                      className="w-5 h-5 text-red-600 bg-gray-700 border-gray-600 rounded focus:ring-red-500 focus:ring-2"
                    />
                    <span className="text-white font-medium">{memberName}</span>
                  </label>
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
                      // Refresh check-in status after check-in
                      await fetchFamilyCheckinStatus(memberEmail!);
                      setSelectedFamilyMembers([]);
                    } else {
                      const err = await res.json();
                      setStatus("error");
                      setMessage(err.detail || "Family check-in failed.");
                    }
                  } catch {
                    setStatus("error");
                    setMessage("Network error. Please try again.");
                  }
                }}
                disabled={selectedFamilyMembers.length === 0}
                className="w-full bg-gradient-to-r from-red-700 via-red-500 to-pink-500 text-white py-3 px-6 rounded-lg font-semibold hover:from-pink-600 hover:to-red-700 transition-all duration-300 shadow-lg hover:shadow-black/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Check In Selected Members ({selectedFamilyMembers.length})
              </button>
            </div>
          </motion.div>
        )}

        {/* NEW USER STATE: No recognition - show registration form + returning user button */}
        {status === "register" && familyMembers.length === 0 && (
          <>
            <motion.div
              className="w-full max-w-md mb-2"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <button
                type="button"
                className="w-full bg-gradient-to-r from-black via-gray-800 to-gray-900 border border-gray-800 rounded-lg p-3 text-white text-center text-base font-semibold focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-200"
                onClick={() => setCheckinByName((v) => !v)}
              >
                {checkinByName ? "Back to Register" : "Already Registered? Tap Here To Check In!"}
              </button>
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
                        
                        // STEP 4: Check in all entered members using family check-in
                        // Only check in members that actually exist in the family now
                        const membersToCheckIn = allNames.filter(name => 
                           familyMemberNames.some((familyName: string) => 
                             familyName.toLowerCase().trim() === name.toLowerCase().trim()
                           )
                         );
                        
                        console.log("🔍 STEP 4: Checking in members...");
                        console.log("- All entered names:", allNames);
                        console.log("- Family member names:", familyMemberNames);
                        console.log("- Members to check in:", membersToCheckIn);
                        
                        const familyCheckinRes = await fetch(`${API_URL}/family/checkin`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            email: familyEmail,
                            member_names: membersToCheckIn,
                          }),
                    });
                    
                        if (familyCheckinRes.ok) {
                          const checkinResult = await familyCheckinRes.json();
                          console.log("✅ Check-in successful:", checkinResult);
                      setStatus("success");
                          if (familyMemberNames.length > 1) {
                            setMessage("All family members have checked in for this period!");
                          } else {
                            setMessage("Check-in successful! Welcome back.");
                          }
                        } else {
                          const err = await familyCheckinRes.json();
                          console.error("❌ Check-in failed:", err);
                          setStatus("error");
                          setMessage(err.detail || "Check-in failed.");
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
                  {/* Family Toggle */}
                  <motion.div className="flex justify-center mb-4">
                    <button
                      type="button"
                      onClick={() => setIsFamily(!isFamily)}
                      className={`px-6 py-2 rounded-full font-semibold transition-all duration-200 border-2 ${
                        isFamily 
                          ? 'bg-gray-800 text-white/70 border-gray-700 hover:bg-gray-700' 
                          : 'bg-gradient-to-r from-red-600 to-red-700 text-white border-red-600'
                      }`}
                    >
                      {isFamily ? 'Go Back' : '👨‍👩‍👧‍👦 Family?'}
                    </button>
                  </motion.div>
                  
                  <motion.div className="space-y-2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                    <label className="block text-lg font-medium text-white/90">Full Name</label>
                    <input className="input-field" placeholder="Enter your full name" type="text" value={formName} onChange={e => setFormName(e.target.value)} required />
                  </motion.div>
                  
                  {/* Family member fields - only show if family mode is active */}
                  {isFamily && familyNames.map((name, idx) => (
                    <motion.div key={idx} className="flex items-center gap-2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + idx * 0.1 }}>
                      <input className="input-field flex-1" placeholder="Enter family member's full name" type="text" value={name} onChange={e => handleFamilyNameChange(idx, e.target.value)} required />
                      <button type="button" className="text-red-400 font-bold px-2" onClick={() => removeFamilyMember(idx)} aria-label="Remove family member">&times;</button>
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
                    <label className="block text-lg font-medium text-white/90">Email Address</label>
                    <input
                      className="input-field"
                      placeholder="Enter your email"
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      required
                    />
                  </motion.div>
                  <motion.button
                    className="w-full bg-gradient-to-r from-red-700 via-red-500 to-pink-500 text-white py-3 px-6 rounded-lg font-semibold hover:from-pink-600 hover:to-red-700 transition-all duration-300 shadow-lg hover:shadow-black/30"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                  >
                    {isFamily ? 'Register Family & Check In' : 'Register & Check In'}
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
                        
                        // STEP 4: Check in all entered members using family check-in
                        // Only check in members that actually exist in the family now
                        const membersToCheckIn = allNames.filter(name => 
                           familyMemberNames.some((familyName: string) => 
                             familyName.toLowerCase().trim() === name.toLowerCase().trim()
                           )
                         );
                        
                        console.log("🔍 STEP 4: Checking in members...");
                        console.log("- All entered names:", allNames);
                        console.log("- Family member names:", familyMemberNames);
                        console.log("- Members to check in:", membersToCheckIn);
                        
                        const familyCheckinRes = await fetch(`${API_URL}/family/checkin`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            email: familyEmail,
                            member_names: membersToCheckIn,
                          }),
                        });
                        
                        if (familyCheckinRes.ok) {
                          const checkinResult = await familyCheckinRes.json();
                          console.log("✅ Check-in successful:", checkinResult);
                          setStatus("success");
                          if (familyMemberNames.length > 1) {
                            setMessage("All family members have checked in for this period!");
                          } else {
                            setMessage("Check-in successful! Welcome back.");
                          }
                        } else {
                          const err = await familyCheckinRes.json();
                          console.error("❌ Check-in failed:", err);
                          setStatus("error");
                          setMessage(err.detail || "Check-in failed.");
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
                    <label className="block text-lg font-medium text-white/90">Full Name</label>
                    <input className="input-field" placeholder="Enter your full name" type="text" value={formName} onChange={e => setFormName(e.target.value)} required />
                  </motion.div>
                  {/* Family member fields */}
                  {familyNames.map((name, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input className="input-field flex-1" placeholder="Enter family member's full name" type="text" value={name} onChange={e => handleFamilyNameChange(idx, e.target.value)} required />
                      <button type="button" className="text-red-400 font-bold px-2" onClick={() => removeFamilyMember(idx)} aria-label="Remove family member">&times;</button>
                    </div>
                  ))}
                  <button type="button" className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition-colors duration-200" onClick={addFamilyMember}>
                    + Add Family Member
                  </button>
                  <motion.button
                    className="w-full bg-gradient-to-r from-red-700 via-red-500 to-pink-500 text-white py-3 px-6 rounded-lg font-semibold hover:from-pink-600 hover:to-red-700 transition-all duration-300 shadow-lg hover:shadow-black/30"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                  >
                    Check In
                  </motion.button>
                </div>
              </motion.form>
            )}
          </>
        )}

        {/* Loading and Error States */}
        <AnimatePresence>
          {(status === "checking-in" || status === "loading" || status === "error") && (
            <motion.div 
              className="w-full max-w-md space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {(status === "checking-in" || status === "loading") && (
                <motion.div 
                  className="glass-card flex flex-col items-center p-6"
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-red-500 mb-4"></div>
                  <p className="text-xl font-medium text-white/90">
                    {status === "checking-in" ? "Checking you in..." : "Processing..."}
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
      </div>
    </div>
  );
}

export default MemberCheckin; 