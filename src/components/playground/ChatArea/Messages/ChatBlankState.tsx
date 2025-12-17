'use client'

import Link from 'next/link'
import { motion, Variants } from 'framer-motion'
import Icon from '@/components/ui/icon'
import { IconType } from '@/components/ui/icon/types'
import React, { useState } from 'react'
import { usePlaygroundStore } from '@/store'
import { useQueryState } from 'nuqs'
import { InfoIcon } from 'lucide-react'

const EXTERNAL_LINKS = {
  documentation: 'https://agno.link/agent-ui',
  playground: 'https://app.agno.com/playground/agents',
  agno: 'https://agno.com'
}

const TECH_ICONS = [
  {
    type: 'agno' as IconType,
    position: 'left-0',
    link: 'https://agno.com',
    name: 'Agno',
    zIndex: 10
  },
  {
    type: 'agent-ui' as IconType,
    position: 'left-[15px]',
    link: 'https://agno.link/agent-ui',
    name: 'Agent UI',
    zIndex: 20
  },
  {
    type: 'nextjs' as IconType,
    position: 'left-[30px]',
    link: 'https://nextjs.org',
    name: 'Next.js',
    zIndex: 30
  },
  {
    type: 'shadcn' as IconType,
    position: 'left-[45px]',
    link: 'https://ui.shadcn.com',
    name: 'shadcn/ui',
    zIndex: 40
  },
  {
    type: 'tailwind' as IconType,
    position: 'left-[60px]',
    link: 'https://tailwindcss.com',
    name: 'Tailwind CSS',
    zIndex: 50
  }
]

interface ActionButtonProps {
  href: string
  variant?: 'primary'
  text: string
}

const ActionButton = ({ href, variant, text }: ActionButtonProps) => {
  const baseStyles =
    'px-4 py-2 text-sm transition-colors font-dmmono tracking-tight'
  const variantStyles = {
    primary: 'border border-border hover:bg-neutral-800 rounded-xl'
  }

  return (
    <Link
      href={href}
      target="_blank"
      className={`${baseStyles} ${variant ? variantStyles[variant] : ''}`}
    >
      {text}
    </Link>
  )
}

const ChatBlankState = () => {
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null)
  const [showAgentTip, setShowAgentTip] = useState(false)
  const { agents } = usePlaygroundStore()
  const [agentId] = useQueryState('agent')

  // Find the currently selected agent
  const selectedAgent = agents.find((agent) => agent.value === agentId)
  const agentTip = selectedAgent?.agent_tip

  // Animation variants for the icon
  const iconVariants: Variants = {
    initial: { y: 0 },
    hover: {
      y: -8,
      transition: {
        type: 'spring',
        stiffness: 150,
        damping: 10,
        mass: 0.5
      }
    },
    exit: {
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 200,
        damping: 15,
        mass: 0.6
      }
    }
  }

  // Animation variants for the tooltip
  const tooltipVariants: Variants = {
    hidden: {
      opacity: 0,
      transition: {
        duration: 0.15,
        ease: 'easeInOut'
      }
    },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.15,
        ease: 'easeInOut'
      }
    }
  }

  return (
    <section
      className="flex flex-col items-center text-center font-geist"
      aria-label="Welcome message"
    >
      <div className="flex max-w-6xl flex-col gap-y-8">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-3xl font-[600] tracking-tight"
        >
          <div className="flex items-center justify-center gap-x-2 whitespace-nowrap font-medium">
            <span className="flex items-center font-[600]">
              This is a Cybersecurity Workbench
            </span>
            {/* <span className="inline-flex translate-y-[10px] scale-125 items-center transition-transform duration-200 hover:rotate-6">
              <Link
                href={EXTERNAL_LINKS.agno}
                target="_blank"
                rel="noopener"
                className="cursor-pointer"
              >
                <Icon type="agno-tag" size="default" />
              </Link>
            </span> */}
            <span className="flex items-center font-[600]">
              Agent UI, built with
            </span>
            <span className="inline-flex translate-y-[5px] scale-125 items-center">
              <div className="relative ml-2 h-[40px] w-[90px]">
                {TECH_ICONS.map((icon) => (
                  <motion.div
                    key={icon.type}
                    className={`absolute ${icon.position} top-0`}
                    style={{ zIndex: icon.zIndex }}
                    variants={iconVariants}
                    initial="initial"
                    whileHover="hover"
                    animate={hoveredIcon === icon.type ? 'hover' : 'exit'}
                    onHoverStart={() => setHoveredIcon(icon.type)}
                    onHoverEnd={() => setHoveredIcon(null)}
                  >
                    <Link
                      href={icon.link}
                      target="_blank"
                      rel="noopener"
                      className="relative block cursor-pointer"
                    >
                      <div>
                        <Icon type={icon.type} size="default" />
                      </div>
                      <motion.div
                        className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 transform whitespace-nowrap rounded bg-neutral-800 px-2 py-1 text-xs text-primary"
                        variants={tooltipVariants}
                        initial="hidden"
                        animate={
                          hoveredIcon === icon.type ? 'visible' : 'hidden'
                        }
                      >
                        {icon.name}
                      </motion.div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </span>
          </div>
          {/* <p>For the full experience, visit the Agent Playground.</p> */}
          {agentTip && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.6 }}
              className="mt-6 flex items-start justify-center gap-2 text-base"
            >
              <div className="relative inline-flex items-center">
                <motion.div
                  className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primaryAccent/50 px-4 py-3 text-sm"
                  onHoverStart={() => setShowAgentTip(true)}
                  onHoverEnd={() => setShowAgentTip(false)}
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                >
                  <InfoIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  <span className="text-muted-foreground whitespace-pre-line">
                    {agentTip}
                  </span>
                </motion.div>
                {showAgentTip && (
                  <motion.div
                    className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 transform whitespace-nowrap rounded bg-neutral-800 px-2 py-1 text-xs text-primary"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    Agent Tip
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex justify-center gap-4"
        >
          <ActionButton
            href={EXTERNAL_LINKS.documentation}
            variant="primary"
            text="GO TO DOCS"
          />
          {/* <ActionButton
            href={EXTERNAL_LINKS.playground}
            text="VISIT AGENT PLAYGROUND"
          /> */}
        </motion.div>
      </div>
    </section>
  )
}

export default ChatBlankState
