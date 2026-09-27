import { auth } from "@/_app/api-routes/auth";
import HomePage from "@/_pages/home";

export default async function Page() {
  const session = await auth();
  return <HomePage email={session!.user.email!} />;
}
