import { useGetUser } from "../../api/user/hooks/useGetUser";
import { useLogin } from "../../api/user/hooks/useLogin";

export function UserView() {
  const { data: user, isLoading, error } = useGetUser();
  const { logout } = useLogin();

  if (isLoading) return <div>Loading…</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!user) return null;

  return (
    <div style={{ padding: 24 }}>
      <h1>Profile</h1>
      <p>Email: {user.email}</p>
      <p>Name: {user.full_name ?? "—"}</p>
      <p>Active: {user.is_active ? "Yes" : "No"}</p>
      <button onClick={logout} style={{ marginTop: 16 }}>Sign Out</button>
    </div>
  );
}
