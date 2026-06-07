"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DynamicUpiQr } from "../components/DynamicUpiQr";

const COMMITTEES = [
  "UNGA-ESS",
  "UNHRC",
  "UNCSW",
  "FIFA",
  "Lok Sabha",
  "Arab League",
  "International Press / IP",
  "UNSC",
  "ECOFIN",
  "IPL",
  "DISEC",
  "UNODC"
];

function formatCurrency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "0";
  return amount.toLocaleString("en-IN");
}

export function RegistrationClient() {
  const router = useRouter();
  const [flow, setFlow] = useState<"choose" | "individual" | "delegation">("choose");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Individual Form States
  const [indAccommodation, setIndAccommodation] = useState("No");
  const [isPartOfDelegation, setIsPartOfDelegation] = useState("No");

  // Delegation Form States
  const [delAccommodation, setDelAccommodation] = useState("No");
  const [totalDelegates, setTotalDelegates] = useState<number | "">("");

  // Calculate pricing dynamically
  const isIndAccommodation = indAccommodation === "Yes";
  const individualPrice = isIndAccommodation ? 5100 : 2100;

  const isDelAccommodation = delAccommodation === "Yes";
  const delegatesCount = typeof totalDelegates === "number" ? totalDelegates : 0;
  
  let delegationPricePerPerson = 0;
  if (delegatesCount >= 20) {
    delegationPricePerPerson = isDelAccommodation ? 4900 : 1900;
  } else if (delegatesCount >= 10) {
    delegationPricePerPerson = isDelAccommodation ? 5000 : 2000;
  }
  const delegationTotalPrice = delegatesCount * delegationPricePerPerson;

  // Success View State
  const [successData, setSuccessData] = useState<any | null>(null);

  function validateForm(formData: FormData) {
    const errors: string[] = [];
    if (flow === "individual") {
      const name = String(formData.get("name") || "").trim();
      const email = String(formData.get("email") || "").trim();
      const phone = String(formData.get("phone") || "").trim();
      const age = Number(formData.get("age"));
      const dob = String(formData.get("dob") || "").trim();
      const gender = String(formData.get("gender") || "").trim();
      const institution = String(formData.get("institution") || "").trim();
      const gradeYear = String(formData.get("gradeYear") || "").trim();
      const committee1 = String(formData.get("committee1") || "").trim();
      const portfolio1 = String(formData.get("portfolio1") || "").trim();
      const committee2 = String(formData.get("committee2") || "").trim();
      const portfolio2 = String(formData.get("portfolio2") || "").trim();
      const city = String(formData.get("city") || "").trim();

      if (name.length < 2) errors.push("Enter your full name.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Enter a valid email address.");
      if (!/^[0-9+\-\s()]{7,20}$/.test(phone)) errors.push("Enter a valid phone number.");
      if (!age || age <= 0) errors.push("Enter a valid age.");
      if (!dob) errors.push("Enter your date of birth.");
      if (!gender) errors.push("Select your gender.");
      if (!institution) errors.push("Enter your institution name.");
      if (!gradeYear) errors.push("Enter your grade/year.");
      if (!committee1) errors.push("Select committee preference 1.");
      if (!portfolio1) errors.push("Enter portfolio preference 1.");
      if (!committee2) errors.push("Select committee preference 2.");
      if (!portfolio2) errors.push("Enter portfolio preference 2.");
      if (!city) errors.push("Enter your city of residence.");

      if (isPartOfDelegation === "Yes" && !String(formData.get("delegationName") || "").trim()) {
        errors.push("Enter your delegation name.");
      }
    } else if (flow === "delegation") {
      const delegationName = String(formData.get("delegationName") || "").trim();
      const coTeacherName = String(formData.get("coTeacherName") || "").trim();
      const coTeacherPhone = String(formData.get("coTeacherPhone") || "").trim();
      const coTeacherEmail = String(formData.get("coTeacherEmail") || "").trim();
      const city = String(formData.get("city") || "").trim();
      const delegatesText = String(formData.get("delegateNames") || "").trim();

      if (!delegationName) errors.push("Enter delegation name.");
      if (!coTeacherName) errors.push("Enter coordinating teacher / head delegate name.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(coTeacherEmail)) errors.push("Enter a valid co-ordinating teacher email.");
      if (!/^[0-9+\-\s()]{7,20}$/.test(coTeacherPhone)) errors.push("Enter a valid co-ordinating teacher phone number.");
      if (!city) errors.push("Enter city of residence.");
      if (delegatesCount < 10) {
        errors.push("Minimum delegation size is 10 delegates.");
      }
      if (!delegatesText) errors.push("Enter the names of delegates.");
    }
    const screenshotFile = formData.get("paymentScreenshot") as File | null;
    if (screenshotFile && screenshotFile.size > 0) {
      if (!screenshotFile.type.startsWith("image/")) {
        errors.push("Payment proof must be a valid image screenshot (PNG, JPG, WEBP, etc.). PDFs are not accepted.");
      }
    }
    return errors;
  }

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    // Add flow/type variables
    formData.append("registrationType", flow);
    formData.append("accommodation", flow === "individual" ? indAccommodation : delAccommodation);

    if (flow === "delegation") {
      const delegateNamesStr = String(formData.get("delegateNames") || "").trim();
      const names = delegateNamesStr ? delegateNamesStr.split(/[\n,]+/).map(n => n.trim()).filter(Boolean) : [];
      const delegatesArray = names.map(name => ({ name }));
      formData.append("delegates", JSON.stringify(delegatesArray));
    }
    
    const errors = validateForm(formData);
    if (errors.length) {
      setMessage(errors.join(" "));
      setMessageType("error");
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    setMessageType("");

    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        body: formData
      });

      const payload = await response.json();

      if (!response.ok) {
        const detail = Array.isArray(payload.details) ? ` ${payload.details.join(" ")}` : "";
        setMessage(`${payload.error || "Registration could not be saved."}${detail}`);
        setMessageType("error");
        return;
      }

      setMessage("Registration saved successfully!");
      setMessageType("success");
      setSuccessData(payload);
    } catch {
      setMessage("Could not reach the registration server. Please check your connection and try again.");
      setMessageType("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (successData) {
    const isIndividual = successData.registrationType === "individual";
    const totalAmount = isIndividual ? individualPrice : delegationTotalPrice;

    return (
      <div className="registration-success-container" style={{ padding: "40px", background: "white", borderRadius: "24px", border: "1px solid rgba(109,67,200,0.15)", boxShadow: "0 20px 60px rgba(51, 36, 88, 0.08)" }}>
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <span style={{ fontSize: "4rem" }}>🎉</span>
          <h2 style={{ fontSize: "2rem", fontWeight: "900", color: "var(--purple)", marginTop: "10px" }}>Registration Successful!</h2>
          <p style={{ color: "var(--text-muted)", marginTop: "8px" }}>Your registration details have been saved in the system.</p>
        </div>

        <div style={{ padding: "20px", background: "#fbf9ff", borderRadius: "16px", border: "1px solid #e9e5f0", marginBottom: "30px" }}>
          <h3 style={{ fontWeight: "bold", fontSize: "1.1em", marginBottom: "12px" }}>Access Your Dashboards</h3>
          
          {isIndividual ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <p>Your unique tracking token has been generated. Use it to check your status and access your QR pass.</p>
              <Link 
                className="button primary" 
                href={`/dashboard?id=${encodeURIComponent(successData.trackingToken)}`}
                style={{ alignSelf: "flex-start", marginTop: "5px" }}
              >
                Go to Delegate Dashboard
              </Link>
            </div>
          ) : (
            <div>
              <p style={{ marginBottom: "15px" }}>The coordination parent record is created. Below are the unique status/dashboard links for your delegates. Please share them with each delegate:</p>
              <div style={{ display: "grid", gap: "12px", maxHeight: "250px", overflowY: "auto", paddingRight: "5px" }}>
                {successData.delegates?.map((d: any) => (
                  <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "white", borderRadius: "10px", border: "1px solid #eef" }}>
                    <span><strong>{d.fullName}</strong> ({d.id})</span>
                    <Link 
                      className="button secondary small-btn" 
                      href={`/dashboard?id=${encodeURIComponent(d.trackingToken)}`}
                      style={{ fontSize: "0.85em", padding: "4px 10px" }}
                    >
                      Open Dashboard
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "20px", background: "rgba(233,216,166,0.1)", borderRadius: "16px", border: "1px solid rgba(233,216,166,0.3)" }}>
          <h3 style={{ fontWeight: "bold", color: "#6f4f00", fontSize: "1.1em", marginBottom: "12px" }}>Payment Instructions</h3>
          <p style={{ fontSize: "0.95em", lineHeight: "1.5" }}>
            Your payment status is currently <strong>PENDING</strong>. Once event admins review your uploaded transaction screenshot, your registration will be verified and your QR pass will be unlocked.
          </p>
          <p style={{ fontSize: "0.95em", marginTop: "10px" }}>
            Total amount paid/under review: <strong>₹{formatCurrency(totalAmount)}</strong>
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", marginTop: "30px", justifyContent: "flex-end" }}>
          <button type="button" className="button secondary" onClick={() => { setSuccessData(null); setFlow("choose"); }}>
            Register Another
          </button>
        </div>
      </div>
    );
  }

  if (flow === "choose") {
    return (
      <div className="registration-flow-chooser">
        <h2>Select Registration Type</h2>
        <p className="flow-intro">Choose how you want to participate in Invictus MUN 2026.</p>
        <div className="flow-cards">
          <button type="button" className="flow-card-btn" onClick={() => setFlow("individual")}>
            <div className="card-icon">👤</div>
            <h3>Individual Delegate</h3>
            <p>Register as a single delegate representing a chosen portfolio and committee.</p>
            <span className="price-tag">Starting from ₹2,100</span>
          </button>
          <button type="button" className="flow-card-btn" onClick={() => setFlow("delegation")}>
            <div className="card-icon">👥</div>
            <h3>Delegation / Group</h3>
            <p>Register a delegation of 10+ members with coordinating teacher or head delegate details and group discounts.</p>
            <span className="price-tag">Starting from ₹1,900 / person</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      <button type="button" className="button secondary" onClick={() => setFlow("choose")} style={{ marginBottom: "20px" }}>
        ← Change Registration Type
      </button>

      <form className="registration-form" id="registrationForm" onSubmit={submitRegistration}>
        {flow === "individual" ? (
          <>
            <fieldset>
              <legend>Personal Details</legend>
              <label>Full name<input required name="name" minLength={2} placeholder="Your full name" /></label>
              <label>Age<input required type="number" name="age" min={1} placeholder="Your age" /></label>
              <label>Date of Birth<input required type="date" name="dob" /></label>
              <label>Gender
                <select name="gender" required>
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </label>
              <label className="wide">School / College / Institution<input required name="institution" placeholder="School / college / institution name" /></label>
              <label>Grade / Year<input required name="gradeYear" placeholder="e.g. 10th grade, 2nd year" /></label>
              <label>City of Residence<input required name="city" placeholder="e.g. Delhi, Mumbai" /></label>
            </fieldset>

            <fieldset>
              <legend>Contact Information</legend>
              <label>Email ID<input required type="email" name="email" placeholder="you@example.com" /></label>
              <label>Phone Number / WhatsApp Number<input required name="phone" minLength={7} maxLength={20} placeholder="+91 98765 43210" /></label>
            </fieldset>

            <div className="wide" style={{ marginBottom: "20px" }}>
              <div style={{
                padding: "20px",
                background: "rgba(109, 67, 200, 0.05)",
                border: "1px dashed rgba(109, 67, 200, 0.3)",
                borderRadius: "16px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "10px",
                textAlign: "center"
              }}>
                <h3 style={{ margin: 0, fontSize: "1.1em", fontWeight: "bold", color: "var(--purple)" }}>Portfolio Matrix</h3>
                <p style={{ margin: 0, fontSize: "0.9em", color: "var(--text-muted)" }}>Check the live seat allotment and availability matrix before filling in your preferences:</p>
                <a 
                  href="https://docs.google.com/spreadsheets/d/1Jiz4Ptn6CxWnQciazo6lqlQncbT_VoLisl_i6HRqHnI/edit?usp=sharing" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="button primary"
                  style={{ display: "inline-block", textDecoration: "none", marginTop: "5px" }}
                >
                  Live Portfolio Matrix
                </a>
              </div>
            </div>

            <fieldset>
              <legend>Committee Preferences</legend>
              <label>Committee Preference 1
                <select name="committee1" required>
                  <option value="">Select committee</option>
                  {COMMITTEES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label>Portfolio Preference for Committee 1<input required name="portfolio1" placeholder="Country / role preference" /></label>
              <label>Committee Preference 2
                <select name="committee2" required>
                  <option value="">Select committee</option>
                  {COMMITTEES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label>Portfolio Preference for Committee 2<input required name="portfolio2" placeholder="Country / role preference" /></label>
              <label className="wide">Prior MUN Experience<textarea name="experience" placeholder="Detail any prior MUN experience (optional)" rows={3} /></label>
            </fieldset>

            <fieldset>
              <legend>Logistics & Delegation</legend>
              <label>Are you availing accommodation?
                <select value={indAccommodation} onChange={(e) => setIndAccommodation(e.target.value)} required>
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </label>
              <label>Are you part of a delegation?
                <select value={isPartOfDelegation} onChange={(e) => setIsPartOfDelegation(e.target.value)} required>
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </label>
              {isPartOfDelegation === "Yes" && (
                <label className="wide">Delegation Name<input required name="delegationName" placeholder="Enter delegation name" /></label>
              )}
              <label>Reference Person (optional)<input name="refPerson" placeholder="Name of referrer" /></label>
              <label className="wide">Anything else you wish to tell us?<textarea name="requirements" placeholder="Food, medical, access needs or notes (optional)" rows={2} /></label>
            </fieldset>

            <fieldset>
              <legend>Payment Details</legend>
              <div className="wide" style={{ marginBottom: "15px" }}>
                <div className="empty-panel" style={{ padding: "20px", background: "rgba(109,67,200,.04)", border: "1px solid rgba(109,67,200,.1)", borderRadius: "12px" }}>
                  <h3 style={{ fontWeight: "bold", color: "var(--purple)", marginBottom: "8px" }}>Calculated Registration Fee</h3>
                  <p style={{ fontSize: "1.8em", fontWeight: "bold", margin: "10px 0 0" }}>
                    ₹{formatCurrency(individualPrice)}
                  </p>
                  <small style={{ color: "var(--text-muted)", display: "block", marginTop: "5px" }}>
                    {isIndAccommodation ? "Includes delegate fee + accommodation" : "Delegate fee only"}
                  </small>
                </div>
              </div>
              <div className="wide" style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "20px 0", padding: "20px", background: "white", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <h4 style={{ fontWeight: "bold", color: "var(--purple)", marginBottom: "12px", textAlign: "center" }}>Scan QR Code to Pay via UPI</h4>
                <DynamicUpiQr amount={individualPrice} />
                <p style={{ fontSize: "0.85em", color: "var(--text-muted)", marginTop: "15px", textAlign: "center", lineHeight: "1.4" }}>
                  Scan the QR code above using GPay, PhonePe, Paytm, or any UPI app.<br />
                  Once payment is complete, take a screenshot of the successful transaction page and upload it below.
                </p>
              </div>
              <label className="wide">Payment Screenshot Upload (UPI / Bank Transfer)
                <input required type="file" name="paymentScreenshot" accept="image/*" style={{ marginTop: "10px" }} />
              </label>
            </fieldset>
          </>
        ) : (
          <>
            <fieldset>
              <legend>Delegation Details</legend>
              <label>Name of Delegation<input required name="delegationName" placeholder="Delegation name" /></label>
              <label>Name of Institution (optional)<input name="institution" placeholder="School / college name" /></label>
              <label>City of Residence<input required name="city" placeholder="e.g. Delhi, Mumbai" /></label>
            </fieldset>

            <fieldset>
              <legend>Co-ordinating Teacher / Head Delegate</legend>
              <label>Full Name<input required name="coTeacherName" placeholder="Co-ordinating Teacher / Head Delegate name" /></label>
              <label>Contact Number<input required name="coTeacherPhone" placeholder="Contact number" /></label>
              <label className="wide">Email ID<input required type="email" name="coTeacherEmail" placeholder="teacher@school.com" /></label>
            </fieldset>

            <div className="wide" style={{ marginBottom: "20px" }}>
              <div style={{
                padding: "20px",
                background: "rgba(109, 67, 200, 0.05)",
                border: "1px dashed rgba(109, 67, 200, 0.3)",
                borderRadius: "16px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "10px",
                textAlign: "center"
              }}>
                <h3 style={{ margin: 0, fontSize: "1.1em", fontWeight: "bold", color: "var(--purple)" }}>Portfolio Matrix</h3>
                <p style={{ margin: 0, fontSize: "0.9em", color: "var(--text-muted)" }}>Check the live seat allotment and availability matrix before filling in your preferences:</p>
                <a 
                  href="https://docs.google.com/spreadsheets/d/1Jiz4Ptn6CxWnQciazo6lqlQncbT_VoLisl_i6HRqHnI/edit?usp=sharing" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="button primary"
                  style={{ display: "inline-block", textDecoration: "none", marginTop: "5px" }}
                >
                  Live Portfolio Matrix
                </a>
              </div>
            </div>

            <fieldset>
              <legend>Delegates Roster</legend>
              <label className="wide">Total Number of Delegates
                <input
                  required
                  type="number"
                  name="totalDelegates"
                  min={1}
                  value={totalDelegates}
                  onChange={(e) => {
                    const val = e.target.value === "" ? "" : Number(e.target.value);
                    setTotalDelegates(val);
                  }}
                  placeholder="Minimum 10 delegates required"
                />
              </label>
              {totalDelegates !== "" && delegatesCount < 10 && (
                <div className="wide form-message error" style={{ marginTop: "0", marginBottom: "15px", fontWeight: "bold" }}>
                  ⚠️ Minimum delegation size is 10 delegates. Please use Individual Delegate Registration or contact the secretariat.
                </div>
              )}
              <label className="wide">Names of Delegates Presently
                <textarea
                  required
                  name="delegateNames"
                  placeholder="Enter the full names of all delegates, separated by commas or lines"
                  rows={6}
                />
              </label>
            </fieldset>

            <fieldset>
              <legend>Logistics & Accommodation</legend>
              <label className="wide">Do you require accommodation?
                <select value={delAccommodation} onChange={(e) => setDelAccommodation(e.target.value)} required>
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </label>
              <label className="wide">Anything else you wish to tell us?<textarea name="requirements" placeholder="Logistics, food or medical needs (optional)" rows={2} /></label>
            </fieldset>

            <fieldset>
              <legend>Payment Details</legend>
              <div className="wide" style={{ marginBottom: "15px" }}>
                <div className="empty-panel" style={{ padding: "20px", background: "rgba(109,67,200,.04)", border: "1px solid rgba(109,67,200,.1)", borderRadius: "12px" }}>
                  <h3 style={{ fontWeight: "bold", color: "var(--purple)", marginBottom: "8px" }}>Calculated Registration Fee</h3>
                  {delegatesCount < 10 ? (
                    <p style={{ color: "var(--text-muted)", fontStyle: "italic", margin: "10px 0 0" }}>
                      Please enter a valid delegate count (min 10)
                    </p>
                  ) : (
                    <>
                      <p style={{ fontSize: "1.8em", fontWeight: "bold", margin: "10px 0 0" }}>
                        ₹{formatCurrency(delegationTotalPrice)}
                      </p>
                      <small style={{ color: "var(--text-muted)", display: "block", marginTop: "5px" }}>
                        {delegatesCount} delegates @ ₹{formatCurrency(delegationPricePerPerson)} per delegate ({isDelAccommodation ? "with accommodation" : "without accommodation"})
                      </small>
                    </>
                  )}
                </div>
              </div>
              {delegatesCount >= 10 && (
                <div className="wide" style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "20px 0", padding: "20px", background: "white", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.05)" }}>
                  <h4 style={{ fontWeight: "bold", color: "var(--purple)", marginBottom: "12px", textAlign: "center" }}>Scan QR Code to Pay via UPI</h4>
                  <DynamicUpiQr amount={delegationTotalPrice} />
                  <p style={{ fontSize: "0.85em", color: "var(--text-muted)", marginTop: "15px", textAlign: "center", lineHeight: "1.4" }}>
                    Scan the QR code above using GPay, PhonePe, Paytm, or any UPI app.<br />
                    Once payment is complete, take a screenshot of the successful transaction page and upload it below.
                  </p>
                </div>
              )}
              <label className="wide">Payment Screenshot Upload (UPI / Bank Transfer)
                <input required type="file" name="paymentScreenshot" accept="image/*" style={{ marginTop: "10px" }} disabled={delegatesCount < 10} />
              </label>
            </fieldset>
          </>
        )}

        <button
          className="button primary"
          type="submit"
          disabled={isSubmitting || (flow === "delegation" && delegatesCount < 10)}
        >
          {isSubmitting ? "Submitting..." : "Submit Registration"}
        </button>
        {message ? <p className={`form-message ${messageType}`} role="status">{message}</p> : null}
      </form>
    </div>
  );
}
