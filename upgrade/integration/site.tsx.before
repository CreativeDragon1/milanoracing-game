import ThemeToggle, { ThemePreference } from "./ThemeToggle";
import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { contact } from "../content";
import { Press, Reveal, TactileLink, physics } from "../motion";

import { asset } from "../assets";
export { asset } from "../assets";
export function SingaporeFlag(){
  return <svg className="sg-flag" width="27" height="18" viewBox="0 0 60 40" role="img" aria-label="Singapore flag"><rect width="60" height="40" fill="#fff"/><path d="M0 0h60v20H0z" fill="#ef3340"/><circle cx="11" cy="10" r="7" fill="#fff"/><circle cx="14" cy="8.5" r="6.6" fill="#ef3340"/>{[[23,4.5],[27.5,8],[25.8,13.3],[20.2,13.3],[18.5,8]].map(([x,y])=><polygon key={x} transform={`translate(${x} ${y})`} fill="#fff" points="0,-2.1 .5,-.7 2,-.7 .8,.25 1.25,1.8 0,.85 -1.25,1.8 -.8,.25 -2,-.7 -.5,-.7"/>)}</svg>;
}
export const nav = [
  ["/", "Home"],
  ["/evolution", "Car Evolution"],
  ["/team", "Team"],
  ["/journal", "Journal"],
  ["/partners", "Partners"],
];
export function ArrowLink({
  to,
  children,
  light = false,
}: {
  to: string;
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <TactileLink className={`button ${light ? "secondary" : "primary"}`} to={to}>
      {children}
      <ArrowUpRight size={17} />
    </TactileLink>
  );
}
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="eyebrow">
      {children}
    </div>
  );
}
export function Heading({
  label,
  title,
  description,
}: {
  label?: string;
  title: string;
  description: React.ReactNode;
}) {
  return (
    <Reveal className="page-heading">
      {label && <Eyebrow>{label}</Eyebrow>}
      <h1>{title}</h1>
      <p>{description}</p>
    </Reveal>
  );
}
export function Header() {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [location.pathname]);
  return (
    <header className="header">
      <div className="header-inner">
        <Link className="brand" to="/" aria-label="Milano Racing home">
          <span className="logo-window">
            <img className="logo-light" src={asset("milano-official.png")} alt="" /><img className="logo-dark" src={asset("milano-dark.svg")} alt="" />
          </span>
          <span>
            MILANO<span className="brand-sub">RACING</span>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          {nav.map(([url, title]) => (
            <NavLink end={url === "/"} to={url} key={url}>
              {({ isActive }) => <>
                {isActive && <motion.span className="nav-active-surface" layoutId="main-nav-active"
                  transition={reduced ? { duration: 0 } : physics.spring} aria-hidden="true" />}
                <span className="nav-title">{title}</span>
              </>}
            </NavLink>
          ))}
        </nav>
        <Link to="/partners#contact" className="header-contact">
          Let’s talk <ArrowUpRight size={16} />
        </Link>
        <ThemeToggle/>
        <Press
          ref={toggle}
          className="menu-toggle icon-button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </Press>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-nav"
            className="mobile-nav"
            aria-label="Mobile navigation"
            initial={reduced ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={reduced ? { duration: 0 } : { ...physics.gentle, opacity: physics.fade }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                toggle.current?.focus();
              }
            }}
          >
            {nav.map(([url, title]) => (
              <NavLink end={url === "/"} key={url} to={url} onClick={() => setOpen(false)}>
                {title}
                <ArrowUpRight size={18} />
              </NavLink>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
export function Footer() {
  const location = useLocation();
  return (
    <footer className="footer">
      <Reveal className="footer-top">
        <div>
          <Eyebrow>Milano Racing / Singapore <SingaporeFlag/></Eyebrow>
          <h2>
            Milano Racing.
            <br />
            See you on the track.
          </h2>
          <Link className="text-link" to="/partners#contact">
            {contact.email}
            <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="footer-links">
          <div>
            <span className="small-label">Explore</span>
            {nav.slice(1).map(([url, title]) => (
              <Link key={url} to={url}>
                {title}
              </Link>
            ))}
          </div>
          <div>
            <span className="small-label">Stay in the loop</span>
            <a href={contact.instagram} target="_blank" rel="noreferrer">
              Instagram ↗
            </a>
            <a href={contact.linkedin} target="_blank" rel="noreferrer">
              LinkedIn ↗
            </a>
            <a href={contact.youtube} target="_blank" rel="noreferrer">
              YouTube ↗
            </a>
          </div>
        </div>
      </Reveal>
      <div className="footer-appearance"><ThemePreference/></div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Milano Racing</span>
        <span>Singapore <SingaporeFlag/></span>
        <Link to={`${location.pathname}#top`}>Back to top ↑</Link>
      </div>
    </footer>
  );
}
