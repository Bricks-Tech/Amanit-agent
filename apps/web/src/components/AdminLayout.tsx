import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { fetchOrders } from "../api";
import { useAuth } from "../auth";

export function AdminLayout() {
  const { user, logout, token } = useAuth();
  const [pendingOrders, setPendingOrders] = useState(0);

  useEffect(() => {
    if (!token) return;
    fetchOrders(token)
      .then((res) => {
        setPendingOrders(
          res.orders.filter((order) => order.status === "PENDING" || order.status === "CONFIRMED")
            .length
        );
      })
      .catch(() => setPendingOrders(0));
  }, [token]);

  return (
    <div className="admin-root admin-shell">
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <img src="/assets/sidebar-logo.png" alt="" width={34} height={34} />
          <span>Amanit</span>
        </div>
        <nav className="sidebar-nav" aria-label="Admin">
          <NavLink to="/dashboard" end>
            <img src="/assets/nav-dashboard.svg" alt="" width={20} height={20} />
            Dashboard
          </NavLink>
          <NavLink to="/dashboard/conversations">
            <img src="/assets/nav-conversations.svg" alt="" width={20} height={20} />
            Conversations
          </NavLink>
          <NavLink to="/dashboard/orders">
            <img src="/assets/nav-orders.svg" alt="" width={20} height={20} />
            Orders
            {pendingOrders > 0 ? <span className="nav-badge">{pendingOrders}</span> : null}
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <p className="user">{user?.email}</p>
          <button type="button" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <Outlet />
      </div>
    </div>
  );
}
