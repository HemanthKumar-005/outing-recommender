"use client";
import GroupPlanner from "../../../components/GroupPlanner";

export default function GroupsPage() {
  return (
    <>
      <div className="dash-header">
        <h1 className="dash-greeting">Groups</h1>
        <p className="dash-sub">Combine preferences so nobody is miserable.</p>
      </div>
      <div style={{ maxWidth: 720 }}>
        <GroupPlanner />
      </div>
    </>
  );
}
