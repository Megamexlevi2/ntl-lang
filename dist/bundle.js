import React from "react";

function Button({label, onClick, variant, disabled}) {
  variant = variant || "primary";
  const styles = { primary: "px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition", secondary: "px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition", danger: "px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition" };
  return React.createElement("button", { className: styles[variant] || styles.primary, onClick: onClick, disabled: disabled || false }, label);
}

function Badge({text, color}) {
  color = color || "blue";
  const colorMap = { green: "bg-green-100 text-green-800", red: "bg-red-100 text-red-800", blue: "bg-blue-100 text-blue-800", gray: "bg-gray-100 text-gray-600" };
  const cls = "text-xs font-semibold px-2 py-0.5 rounded-full " + (colorMap[color] || colorMap.blue);
  return React.createElement("span", { className: cls }, text);
}

function UserCard({user}) {
  const initial = user.name ? user.name[0].toUpperCase() : "?";
  return React.createElement("div", { className: "flex items-center gap-3 py-3 border-b border-gray-100 last:border-0" }, React.createElement("div", { className: "w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm" }, initial), React.createElement("div", { className: "flex-1" }, React.createElement("p", { className: "font-semibold text-gray-900" }, user.name), React.createElement("p", { className: "text-sm text-gray-500" }, user.email)), React.createElement(Badge, { text: user.active ? "Active" : "Inactive", color: user.active ? "green" : "red" }));
}

function UserList({users, loading, error}) {
  if (loading) {
    return React.createElement("p", { className: "text-blue-500 animate-pulse" }, "Loading users...");
  }
  if (error) {
    return React.createElement("p", { className: "text-red-500" }, "Error:", error);
  }
  if (!users || users.length === 0) {
    return React.createElement("p", { className: "text-gray-400 italic" }, "No users found.");
  }
  return React.createElement("div", null, users.map(user => React.createElement(UserCard, { key: user.id, user: user })));
}

function Card({title, description, footer, children}) {
  return React.createElement("div", { className: "bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden" }, React.createElement("div", { className: "px-6 py-4 border-b border-gray-100" }, React.createElement("h2", { className: "text-lg font-bold text-gray-900" }, title), description && React.createElement("p", { className: "text-sm text-gray-500 mt-1" }, description)), React.createElement("div", { className: "px-6 py-4" }, children), footer && React.createElement("div", { className: "px-6 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400" }, footer));
}

function App() {
  const [ users, setUsers ] = React.useState([]);
  const [ loading, setLoading ] = React.useState(true);
  const [ error, setError ] = React.useState(null);
  React.useEffect(() => {
  fetch("/api/users").then(r => r.json()).then(data => {
  setUsers(data.users);
  setLoading(false);
}).catch(e => {
  setError(e.message);
  setLoading(false);
});
  return () => {
};
}, []);
  return React.createElement("div", { className: "min-h-screen bg-gray-50 p-8" }, React.createElement("div", { className: "max-w-xl mx-auto" }, React.createElement("h1", { className: "text-3xl font-bold text-gray-900 mb-2" }, "NTL Full-Stack"), React.createElement("p", { className: "text-gray-500 mb-8" }, "Frontend + Backend in one language"), React.createElement(Card, { title: "Users", description: "Fetched from the NTL backend REST API", footer: "Powered by ntl:http + ntl:db (SQLite)" }, React.createElement(UserList, { users: users, loading: loading, error: error })), React.createElement("div", { className: "mt-4 flex gap-3" }, React.createElement(Button, { label: "Refresh", onClick: () => window.location.reload() }), React.createElement(Button, { label: "Add User", variant: "secondary", onClick: () => alert("Open a modal here") }))));
}

export const App = App;
module.exports.Button = Button;
module.exports.Badge = Badge;
module.exports.Card = Card;
module.exports.UserCard = UserCard;
module.exports.UserList = UserList;
