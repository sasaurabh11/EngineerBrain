import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocation, useOutlet } from "react-router-dom";

const VARIANTS = {
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -14 },
};

/** Route-level transition: the incoming page rises up into place while the
 * outgoing one recedes and fades, rather than a hard cut between routes. */
export function PageTransition() {
  const location = useLocation();
  const element = useOutlet();
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return <>{element}</>;

  return (
    <div className="relative">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={location.pathname}
          variants={VARIANTS}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
        >
          {element}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
