import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode, ElementType } from "react";

/**
 * Reveals children with a staggered fade-in as they enter the viewport.
 * <StaggerReveal><Item /><Item /></StaggerReveal>
 */
export function StaggerReveal({
  children,
  className,
  as: Tag = "div",
  delayChildren = 0.05,
  stagger = 0.08,
  once = true,
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  delayChildren?: number;
  stagger?: number;
  once?: boolean;
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion(Tag);
  const parent: Variants = {
    hidden: {},
    show: {
      transition: {
        delayChildren: reduce ? 0 : delayChildren,
        staggerChildren: reduce ? 0 : stagger,
      },
    },
  };
  return (
    <MotionTag
      className={className}
      variants={parent}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: "-60px" }}
    >
      {children}
    </MotionTag>
  );
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

export function RevealItem({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}) {
  const MotionTag = motion(Tag);
  return (
    <MotionTag className={className} variants={itemVariants}>
      {children}
    </MotionTag>
  );
}
