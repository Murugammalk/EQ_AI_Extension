import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import "./RateUs.css";

const BASE_API = import.meta.env.VITE_BASE_API ?? "http://127.0.0.1:5000";

export const RateUs: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [rating,  setRating]  = useState(0);
  const [hover,   setHover]   = useState(0);
  const [message, setMessage] = useState("");
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const submit = async () => {
    if(!rating) return;
    if(!user?.email){ setError("Please log in first."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${BASE_API}/submit-feedback`, {
        method:"POST", headers:{"Content-Type":"application/json"}, credentials:"include",
        body:JSON.stringify({user_email:user.email, message:message||"No message", rating}),
      });
      if(!res.ok){ const d=await res.json().catch(()=>({})); throw new Error(d.error||"Failed"); }
      setSent(true); setTimeout(()=>navigate("/me"),2000);
    } catch(e:any){ setError(e.message||"Something went wrong."); }
    finally{ setLoading(false); }
  };

  if(sent) return (
    <div className="rateus-page eq-page rateus-success">
      <div className="rateus-success-icon">🎉</div>
      <div className="rateus-success-title">Thank you!</div>
      <div className="rateus-success-sub">Your feedback helps improve EQ</div>
    </div>
  );

  return (
    <div className="rateus-page eq-page">
      <button className="rateus-back" onClick={()=>navigate("/me")}>← Back</button>
      <div className="rateus-title gold-text">Rate EQ of AI</div>
      <p className="rateus-sub">Your honest feedback shapes our detection accuracy</p>
      <div className="rateus-stars">
        {[1,2,3,4,5].map(s=>(
          <button key={s} className={`rateus-star${s<=(hover||rating)?" rateus-star--on":""}`}
            onMouseEnter={()=>setHover(s)} onMouseLeave={()=>setHover(0)} onClick={()=>setRating(s)}>★</button>
        ))}
      </div>
      {error && <div className="rateus-error">{error}</div>}
      <textarea className="rateus-textarea" placeholder="What can we improve? (optional)"
        value={message} onChange={e=>setMessage(e.target.value)} rows={4}/>
      <button className="rateus-submit" onClick={submit} disabled={!rating||loading}>
        {loading ? <><span className="eq-spinner"/> Sending…</> : "Submit Feedback"}
      </button>
    </div>
  );
};
export default RateUs;
