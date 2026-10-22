import { useEffect } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, MotionConfig } from "motion/react";
import { PageMotion } from "./motion";

import { Header, Footer, nav } from "./components/site";
import Home from "./pages/Home";
import Evolution from "./pages/Evolution";
import Team from "./pages/Team";
import Journal from "./pages/Journal";
import Article from "./pages/Article";
import Partners from "./pages/Partners";
import NotFound from "./pages/NotFound";
import Racing from "./pages/Racing";
function RouteFocus() {
  const location = useLocation();
  useEffect(() => {
    if (location.hash) {
      document
        .getElementById(location.hash.slice(1))
        ?.scrollIntoView({ behavior: "instant" });
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [location.pathname, location.search, location.hash, location.key]);
  return null;
}
export default function App() {
  const location = useLocation();
  useEffect(() => {
    const title =
      nav.find(([p]) => p === location.pathname)?.[1] ??
      (location.pathname.startsWith("/journal/")
        ? "Journal"
        : "Page not found");
    document.title = `${title} — Milano Racing`;
  }, [location.pathname, location.hash]);
  return (
    <MotionConfig reducedMotion="user">
      <Link className="skip-link" to={`${location.pathname}#main`}>
        Skip to content
      </Link>
      <div id="top" />
      <Header />
      <main id="main" tabIndex={-1}>
        <AnimatePresence mode="wait" initial={false}>
          <PageMotion key={location.pathname}>
            <RouteFocus />
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/evolution" element={<Evolution />} />
              <Route path="/team" element={<Team />} />
              <Route path="/journal" element={<Journal />} />
              <Route path="/journal/:id" element={<Article />} />
              <Route path="/partners" element={<Partners />} />
              <Route path="/racing" element={<Racing />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </PageMotion>
        </AnimatePresence>
      </main>
      <Footer />
    </MotionConfig>
  );
}
