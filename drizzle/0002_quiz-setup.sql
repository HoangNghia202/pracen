CREATE TABLE "quizQuestion" (
	"id" text PRIMARY KEY NOT NULL,
	"quizId" text NOT NULL,
	"orderIndex" integer NOT NULL,
	"questionType" text NOT NULL,
	"vocabItemId" text NOT NULL,
	"word" text NOT NULL,
	"meaning" text NOT NULL,
	"choices" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz" (
	"id" text PRIMARY KEY NOT NULL,
	"folderId" text NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"questionTypes" text[] NOT NULL,
	"vocabItemIds" text[] NOT NULL,
	"shuffleQuestions" boolean DEFAULT false NOT NULL,
	"shuffleAnswers" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quizQuestion" ADD CONSTRAINT "quizQuestion_quizId_quiz_id_fk" FOREIGN KEY ("quizId") REFERENCES "public"."quiz"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz" ADD CONSTRAINT "quiz_folderId_folder_id_fk" FOREIGN KEY ("folderId") REFERENCES "public"."folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz" ADD CONSTRAINT "quiz_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;