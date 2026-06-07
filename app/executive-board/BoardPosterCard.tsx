"use client";

import { useState } from "react";

type BoardPosterCardProps = {
  name: string;
  committee: string;
  position: string;
  image: string;
  bio?: string | null;
  instagram?: string | null;
  linkedin?: string | null;
};

export function BoardPosterCard({
  name,
  committee,
  position,
  image,
  bio,
  instagram,
  linkedin
}: BoardPosterCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasDetails = Boolean(bio || instagram || linkedin);

  return (
    <>
      <article
        className="eb-poster-card"
        onClick={() => { if (hasDetails) setIsOpen(true); }}
        style={hasDetails ? { cursor: "pointer" } : undefined}
      >
        {image ? (
          <img src={image} alt={`${name}, ${position} for ${committee}`} />
        ) : (
          <div className="portrait" style={{ width: "100%", aspectRatio: "4 / 5", height: "auto" }}>
            {name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
          </div>
        )}
        <div>
          <span>{committee}</span>
          <h3>{name}</h3>
          <p>{position}</p>
        </div>
      </article>

      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(9, 6, 18, 0.65)",
            backdropFilter: "blur(8px)",
            display: "grid",
            placeItems: "center",
            zIndex: 999,
            padding: "20px"
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            className="verify-card"
            style={{
              maxWidth: "500px",
              width: "100%",
              background: "#fff",
              borderRadius: "28px",
              border: "1px solid rgba(109,67,200,0.15)",
              padding: "30px",
              boxShadow: "0 20px 60px rgba(51, 36, 88, 0.15)",
              textAlign: "left",
              color: "var(--ink)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", gap: "20px", marginBottom: "20px", alignItems: "center" }}>
              {image ? (
                <img
                  src={image}
                  alt={name}
                  style={{
                    width: "100px",
                    height: "100px",
                    objectFit: "cover",
                    borderRadius: "20px",
                    border: "1px solid var(--line)"
                  }}
                />
              ) : (
                <div className="portrait small" style={{ width: "100px", height: "100px", fontSize: "28px", borderRadius: "20px" }}>
                  {name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <span style={{ color: "var(--purple)", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: ".12em" }}>{committee}</span>
                <h3 style={{ margin: "5px 0", fontSize: "24px", fontWeight: "bold" }}>{name}</h3>
                <p style={{ margin: 0, color: "var(--muted)", fontWeight: "800" }}>{position}</p>
              </div>
            </div>
            {bio ? (
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ fontSize: "14px", fontWeight: "bold", color: "var(--purple)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: "8px" }}>Biography</h4>
                <p style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.6", margin: 0 }}>{bio}</p>
              </div>
            ) : null}
            {(instagram || linkedin) ? (
              <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                {instagram ? (
                  <a href={instagram} target="_blank" rel="noopener noreferrer" className="button secondary small" style={{ textDecoration: "none" }}>
                    Instagram
                  </a>
                ) : null}
                {linkedin ? (
                  <a href={linkedin} target="_blank" rel="noopener noreferrer" className="button primary small" style={{ textDecoration: "none" }}>
                    LinkedIn
                  </a>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              className="button ghost small"
              onClick={() => setIsOpen(false)}
              style={{ marginTop: "15px", width: "100%" }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
