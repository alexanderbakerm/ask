"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface FaqItem {
	question: string;
	answer: string;
}

function FaqAccordionItem({
	item,
	isOpen,
	onToggle,
}: {
	item: FaqItem;
	isOpen: boolean;
	onToggle: () => void;
}) {
	return (
		<div className="group border-b border-border last:border-0">
			<button
				type="button"
				onClick={onToggle}
				className="flex w-full cursor-pointer items-start justify-between gap-6 py-4 text-left text-base leading-7 text-marketing-fg"
			>
				{item.question}
				<span className="mt-1 shrink-0">
					{isOpen ? (
						<MinusIcon className="size-3.5" strokeWidth={1} />
					) : (
						<PlusIcon className="size-3.5" strokeWidth={1} />
					)}
				</span>
			</button>
			<AnimatePresence initial={false}>
				{isOpen && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
						className="overflow-hidden"
					>
						<div className="pt-1 pb-6 pr-12 text-sm leading-7 text-marketing-fg-muted">
							{item.answer}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

export function FaqSection({
	content,
}: {
	content: { headline: string; items: FaqItem[] };
}) {
	const { items, headline } = content;

	const [openIndex, setOpenIndex] = useState<number | null>(null);

	return (
		<section id="faq" className="py-16 scroll-mt-14">
			<div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-2 gap-y-16 px-6 md:max-w-3xl lg:max-w-7xl lg:grid-cols-2 lg:px-10">
				{/* Header */}
				<div className="flex flex-col gap-6">
					<h2
						className={cn(
							"text-pretty font-display text-[2rem] leading-10 tracking-tight",
							"text-marketing-fg",
							"sm:text-5xl sm:leading-14",
						)}
					>
						{headline}
					</h2>
				</div>

				{/* FAQ Items */}
				<div className="border-t border-border">
					{items.map((item, index) => (
						<FaqAccordionItem
							key={item.question}
							item={item}
							isOpen={openIndex === index}
							onToggle={() => setOpenIndex(openIndex === index ? null : index)}
						/>
					))}
				</div>
			</div>
		</section>
	);
}
