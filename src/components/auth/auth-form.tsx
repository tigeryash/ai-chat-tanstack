import { Field } from "@base-ui/react/field";
import { Form } from "@base-ui/react/form";
import { type RefObject, useEffect, useRef, useState } from "react";
import { fieldErrors } from "@/lib/auth-schemas";
import { useLazyGsap } from "@/lib/lazy-gsap";
import { FULL_MOTION } from "@/lib/reduced-motion";
import type { z } from "@/lib/zod";

// Shared pieces of the email forms on the auth pages (login, sign-up, forgot and reset password).

/** Fades the form's fields in on mount. With reduced motion it never starts (hard rule 3). */
function useFormReveal(scope: RefObject<HTMLElement | null>) {
	useLazyGsap(({ gsap }) => {
		gsap.matchMedia().add(FULL_MOTION, () => {
			gsap.fromTo(
				".form-root",
				{
					opacity: 0,
					y: 50,
				},
				{
					opacity: 1,
					y: 0,
					duration: 1.1,
					stagger: 0.1,
					ease: "power2.inOut",
					delay: 0.1,
				},
			);
		});
	}, scope);
}

interface AuthFormProps {
	/** Field name → messages, shown under the matching `AuthField`. */
	errors: Record<string, string[]>;
	onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
	children: React.ReactNode;
}

export function AuthForm({ errors, onSubmit, children }: AuthFormProps) {
	const formRef = useRef<HTMLFormElement>(null);
	useFormReveal(formRef);

	return (
		<Form
			ref={formRef}
			// Submitted before hydration, the browser sends the form itself. The default GET would put the
			// password in the URL (history, server logs); POST keeps it in the body.
			method="post"
			className="w-full max-w-md space-y-4 flex flex-col items-center justify-center px-2"
			errors={errors}
			onSubmit={onSubmit}
		>
			{children}
		</Form>
	);
}

/**
 * Validates the form with `schema`, then runs `submit` with the parsed values. `submit` resolves to a
 * message for the whole form, or `null` when it worked (the page then shows what comes next).
 */
export function useAuthSubmit<Values>(
	schema: z.ZodType<Values>,
	submit: (values: Values) => Promise<string | null>,
) {
	const [errors, setErrors] = useState<Record<string, string[]>>({});
	const [formError, setFormError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (pending) return;

		const result = schema.safeParse(
			Object.fromEntries(new FormData(event.currentTarget)),
		);
		setFormError(null);
		if (!result.success) {
			setErrors(fieldErrors(result.error));
			return;
		}

		setErrors({});
		setPending(true);
		try {
			setFormError(await submit(result.data));
		} finally {
			setPending(false);
		}
	};

	return { errors, formError, pending, onSubmit };
}

// Underlined so links inside a sentence don't rely on color alone.
export const LINK_CLASS =
	"text-foreground underline decoration-foreground/40 underline-offset-4 hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded";

interface AuthFieldProps {
	name: string;
	label: string;
	type: "text" | "email" | "password";
	autoComplete: string;
	placeholder: string;
	/** Shown at the end of the label row, like a "Forgot password?" link. */
	labelAside?: React.ReactNode;
}

export function AuthField({
	name,
	label,
	type,
	autoComplete,
	placeholder,
	labelAside,
}: AuthFieldProps) {
	return (
		<Field.Root
			name={name}
			className="flex flex-col w-full space-y-2 form-root"
		>
			<div className="flex items-baseline justify-between gap-2">
				<Field.Label className="text-base font-medium text-foreground">
					{label}
				</Field.Label>
				{labelAside}
			</div>
			<Field.Control
				type={type}
				autoComplete={autoComplete}
				placeholder={placeholder}
				className="text-base bg-background/60 border border-input hover:bg-background/80 focus:bg-background rounded-lg px-3 py-2.5 placeholder:text-muted-foreground focus:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 text-foreground"
			/>
			<Field.Error className="text-sm text-destructive" />
		</Field.Root>
	);
}

export function SubmitButton({
	pending,
	children,
}: {
	pending: boolean;
	children: React.ReactNode;
}) {
	return (
		<button
			type="submit"
			disabled={pending}
			aria-busy={pending}
			className="py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 w-full
         transition-all duration-300 hover:scale-[1.02] text-base overflow-hidden cursor-pointer
         focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50
         disabled:cursor-wait disabled:opacity-60 disabled:hover:scale-100 disabled:hover:bg-primary"
		>
			{children}
		</button>
	);
}

/** A problem with the whole form rather than one field, like a 503 from the email guard. */
export function FormAlert({ message }: { message: string | null }) {
	if (!message) return null;
	return (
		<p
			role="alert"
			className="w-full rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive"
		>
			{message}
		</p>
	);
}

interface AuthNoticeProps {
	title: string;
	children: React.ReactNode;
	/** Move focus to the title on mount, so screen readers announce a notice that replaced a form. */
	focusTitle?: boolean;
}

/** Takes the form's place once it has done its job, or when the page can't show one. */
export function AuthNotice({ title, children, focusTitle }: AuthNoticeProps) {
	const titleRef = useRef<HTMLHeadingElement>(null);

	useEffect(() => {
		if (focusTitle) titleRef.current?.focus();
	}, [focusTitle]);

	return (
		<section className="w-full max-w-md space-y-4 px-2 text-base text-foreground">
			<h3
				ref={titleRef}
				tabIndex={-1}
				className="text-xl font-semibold text-foreground focus:outline-none"
			>
				{title}
			</h3>
			{children}
		</section>
	);
}
