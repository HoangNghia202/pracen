CREATE TABLE "attemptAnswer" (
	"id" text PRIMARY KEY NOT NULL,
	"attemptId" text NOT NULL,
	"questionIndex" integer NOT NULL,
	"questionType" text NOT NULL,
	"word" text NOT NULL,
	"meaning" text NOT NULL,
	"userAnswer" text NOT NULL,
	"isCorrect" boolean NOT NULL,
	"aiFeedback" text,
	"answeredAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quizAttempt" (
	"id" text PRIMARY KEY NOT NULL,
	"quizId" text NOT NULL,
	"userId" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"questionsSnapshot" jsonb NOT NULL,
	"currentIndex" integer DEFAULT 0 NOT NULL,
	"totalQuestions" integer NOT NULL,
	"score" integer,
	"startedAt" timestamp DEFAULT now() NOT NULL,
	"finishedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "attemptAnswer" ADD CONSTRAINT "attemptAnswer_attemptId_quizAttempt_id_fk" FOREIGN KEY ("attemptId") REFERENCES "public"."quizAttempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizAttempt" ADD CONSTRAINT "quizAttempt_quizId_quiz_id_fk" FOREIGN KEY ("quizId") REFERENCES "public"."quiz"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizAttempt" ADD CONSTRAINT "quizAttempt_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;