"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type Requirement = {
  material: string;
  required: number;
  unit: string;
};

type Project = {
  id: number;
  name: string;
  customer: string;
  requirements: Requirement[];
};

type Dispatch = {
  id: number;
  date: string;
  projectId: number | null;
  projectName: string;
  customerName: string;
  material: string;
  quantity: number;
  unit: string;
  billNo: string;
};

const MATERIALS = [
  "Modular Kitchen",
  "Wardrobe",
  "Aluminium System Windows",
  "Office Furniture",
];

const UNITS = [
  "Nos",
  "Sq.ft",
  "Running ft",
  "Set",
  "Kg",
];

/* --------------------------------------------------
   SAMPLE DATA
-------------------------------------------------- */

const initialProjects: Project[] = [];

const initialDispatches: Dispatch[] = [];

/* --------------------------------------------------
   MAIN APP
-------------------------------------------------- */

export default function Home() {
  const [activeTab, setActiveTab] = useState("Dashboard");

  const [projects, setProjects] = useState<Project[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [isDataReady, setIsDataReady] = useState(false);
  const [sessionUser, setSessionUser] =
    useState<string | null>(null);
  const [authLoading, setAuthLoading] =
    useState(true);
  const [loginForm, setLoginForm] =
    useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [signupForm, setSignupForm] = useState({ username: "", password: "" });
  const [signupError, setSignupError] = useState("");

  const [showProjectForm, setShowProjectForm] =
    useState(false);

  const [theme, setTheme] =
    useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(
      "dispatch-theme"
    );
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    const initialTheme =
      savedTheme === "dark" || savedTheme === "light"
        ? savedTheme
        : prefersDark
          ? "dark"
          : "light";

    setTheme(initialTheme);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      theme
    );
    document.documentElement.style.colorScheme =
      theme;
    document.body.dataset.theme = theme;
    window.localStorage.setItem(
      "dispatch-theme",
      theme
    );
  }, [theme]);

  useEffect(() => {
    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session");
        const data = await response.json();

        setSessionUser(
          data.authenticated ? data.user ?? null : null
        );
      } catch {
        setSessionUser(null);
      } finally {
        setAuthLoading(false);
      }
    }

    loadSession();
  }, []);

  useEffect(() => {
    if (!sessionUser) return;

    async function loadTeamData() {
      try {
        const response = await fetch(
          "/api/dispatch-tracker"
        );

        if (!response.ok) {
          throw new Error("Failed to load team data");
        }

        const data = await response.json();
        setProjects(data.projects ?? []);
        setDispatches(data.dispatches ?? []);
      } catch (error) {
        console.error("Team data load failed", error);
        setProjects([]);
        setDispatches([]);
      } finally {
        setIsDataReady(true);
      }
    }

    setIsDataReady(false);
    loadTeamData();
  }, [sessionUser]);

  useEffect(() => {
    if (!sessionUser || !isDataReady) return;

    async function saveTeamData() {
      try {
        await fetch("/api/dispatch-tracker", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            projects,
            dispatches,
          }),
        });
      } catch (error) {
        console.error("Team data save failed", error);
      }
    }

    saveTeamData();
  }, [projects, dispatches, isDataReady, sessionUser]);

  async function handleLoginSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoginError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      setSessionUser(data.user ?? null);
     setLoginForm({ username: "", password: "" });
    } catch (error) {
      setLoginError(
        error instanceof Error
          ? error.message
          : "Login failed."
      );
    }
  }

  async function handleSignupSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSignupError("");

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(signupForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Signup failed");
      }

      setSessionUser(data.user ?? null);
      setSignupForm({ username: "", password: "" });
    } catch (error) {
      setSignupError(
        error instanceof Error
          ? error.message
          : "Signup failed."
      );
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });

    setSessionUser(null);
    setProjects([]);
    setDispatches([]);
    setIsDataReady(false);
  }

  /* PROJECT FORM */

  const [projectName, setProjectName] = useState("");
  const [customerName, setCustomerName] = useState("");

  const [requirements, setRequirements] =
    useState<Requirement[]>([
      {
        material: "Modular Kitchen",
        required: 0,
        unit: "Nos",
      },
    ]);

  /* DISPATCH FORM */

  const [dispatchProjectId, setDispatchProjectId] =
    useState("");

  const [dispatchProjectName, setDispatchProjectName] =
    useState("");

  const [dispatchCustomerName, setDispatchCustomerName] =
    useState("");

  const [dispatchMaterial, setDispatchMaterial] =
    useState("");

  const [dispatchQuantity, setDispatchQuantity] =
    useState("");

  const [billNumber, setBillNumber] =
    useState("");

  const [editingDispatch, setEditingDispatch] =
    useState<Dispatch | null>(null);
  const [editProjectName, setEditProjectName] =
    useState("");
  const [materialViewFilter, setMaterialViewFilter] =
    useState<"all" | "pending" | "completed">("all");
  const [projectFilter, setProjectFilter] =
    useState("all");
  const [recordSearch, setRecordSearch] =
    useState("");
  const [recordStatusFilter, setRecordStatusFilter] =
    useState<"all" | "completed" | "pending" | "partial">("all");
  const [editCustomerName, setEditCustomerName] =
    useState("");
  const [editMaterial, setEditMaterial] =
    useState("");
  const [editQuantity, setEditQuantity] =
    useState("");
  const [editBillNumber, setEditBillNumber] =
    useState("");

  /* --------------------------------------------------
     CALCULATIONS
  -------------------------------------------------- */

  function getRequirement(
    projectId: number,
    material: string
  ) {
    const project = projects.find(
      (p) => p.id === projectId
    );

    return project?.requirements.find(
      (r) => r.material === material
    );
  }

  function getAlreadyDispatched(
    projectId: number,
    material: string,
    excludeDispatchId?: number
  ) {
    return dispatches
      .filter(
        (d) =>
          d.projectId === projectId &&
          d.material === material &&
          d.id !== excludeDispatchId
      )
      .reduce(
        (total, dispatch) =>
          total + dispatch.quantity,
        0
      );
  }

  function findMatchingProject(searchTerm: string) {
    const trimmedName = searchTerm.trim().toLowerCase();

    return projects.find(
      (project) =>
        project.name.toLowerCase() === trimmedName ||
        project.customer.toLowerCase() === trimmedName ||
        `${project.name} — ${project.customer}`.toLowerCase() ===
          trimmedName
    );
  }

  function getStatus(
    required: number,
    dispatched: number
  ) {
    if (dispatched >= required) {
      return "Completed";
    }

    if (dispatched > 0) {
      return "Partially Dispatched";
    }

    return "Pending";
  }

  /* --------------------------------------------------
     PROJECT CREATION
  -------------------------------------------------- */

  function addMaterialRequirement() {
    setRequirements([
      ...requirements,
      {
        material: "Modular Kitchen",
        required: 0,
        unit: "Nos",
      },
    ]);
  }

  function removeRequirement(index: number) {
    if (requirements.length === 1) return;

    setRequirements(
      requirements.filter(
        (_, i) => i !== index
      )
    );
  }

  function updateRequirement(
    index: number,
    field: keyof Requirement,
    value: string | number
  ) {
    const updated = [...requirements];

    updated[index] = {
      ...updated[index],
      [field]: value,
    };

    setRequirements(updated);
  }

  function createProject() {
    if (
      !projectName.trim() ||
      !customerName.trim()
    ) {
      alert(
        "Please enter Project Name and Customer Name."
      );
      return;
    }

    const validRequirements =
      requirements.filter(
        (r) => r.required > 0
      );

    if (validRequirements.length === 0) {
      alert(
        "Please add at least one material with a required quantity."
      );
      return;
    }

    const project: Project = {
      id: Date.now(),
      name: projectName,
      customer: customerName,
      requirements: validRequirements,
    };

    setProjects([
      ...projects,
      project,
    ]);

    setProjectName("");
    setCustomerName("");

    setRequirements([
      {
        material: "Modular Kitchen",
        required: 0,
        unit: "Nos",
      },
    ]);

    setShowProjectForm(false);

    alert("Project created successfully.");
  }

  /* --------------------------------------------------
     DISPATCH
  -------------------------------------------------- */

  function handleProjectChange(
    projectName: string
  ) {
    setDispatchProjectName(projectName);

    const project = findMatchingProject(projectName);

    if (project) {
      setDispatchProjectId(String(project.id));
      setDispatchCustomerName(project.customer);
      setDispatchMaterial(
        project.requirements[0]?.material || ""
      );
    } else {
      setDispatchProjectId("");
      setDispatchCustomerName("");
      setDispatchMaterial("");
    }

    setDispatchQuantity("");
  }

  function handleCustomerAutoFill() {
    if (!dispatchProjectName.trim()) return;

    const project = findMatchingProject(
      dispatchProjectName
    );

    if (project) {
      setDispatchCustomerName(project.customer);
    }
  }

  function handleMaterialChange(
    material: string
  ) {
    setDispatchMaterial(material);
    setDispatchQuantity("");
  }

  function startEditDispatch(dispatch: Dispatch) {
    setEditingDispatch(dispatch);
    setEditProjectName(dispatch.projectName);
    setEditCustomerName(dispatch.customerName);
    setEditMaterial(dispatch.material);
    setEditQuantity(String(dispatch.quantity));
    setEditBillNumber(dispatch.billNo);
  }

  function cancelEditDispatch() {
    setEditingDispatch(null);
    setEditProjectName("");
    setEditCustomerName("");
    setEditMaterial("");
    setEditQuantity("");
    setEditBillNumber("");
  }

  function saveEditedDispatch() {
    if (!editingDispatch) return;

    if (!editProjectName.trim()) {
      alert("Please enter a project name.");
      return;
    }

    if (!editMaterial) {
      alert("Please choose a material.");
      return;
    }

    const updatedQuantity = Number(editQuantity);

    if (!editQuantity || Number.isNaN(updatedQuantity) || updatedQuantity <= 0) {
      alert("Please enter a valid dispatch quantity.");
      return;
    }

    if (!editBillNumber.trim()) {
      alert("Bill number is required.");
      return;
    }

    const matchedProject = findMatchingProject(
      editProjectName
    );
    const projectId = matchedProject
      ? matchedProject.id
      : null;

    const requirement = matchedProject
      ? getRequirement(matchedProject.id, editMaterial)
      : undefined;

    if (matchedProject && !requirement) {
      alert("This material is not required for this project.");
      return;
    }

    if (matchedProject && requirement) {
      const alreadyDispatched = getAlreadyDispatched(
        matchedProject.id,
        editMaterial,
        editingDispatch.id
      );
      const remaining =
        requirement.required - alreadyDispatched;

      if (updatedQuantity > remaining + editingDispatch.quantity) {
        alert(
          `Only ${remaining + editingDispatch.quantity} ${requirement.unit} is currently available for this requirement.`
        );
        return;
      }
    }

    setDispatches((current) =>
      current.map((dispatch) =>
        dispatch.id === editingDispatch.id
          ? {
              ...dispatch,
              projectId,
              projectName: editProjectName.trim(),
              customerName:
                editCustomerName.trim() ||
                editProjectName.trim(),
              material: editMaterial,
              quantity: updatedQuantity,
              unit: requirement?.unit || editingDispatch.unit,
              billNo: editBillNumber.trim(),
            }
          : dispatch
      )
    );

    setEditingDispatch(null);
    setEditProjectName("");
    setEditCustomerName("");
    setEditMaterial("");
    setEditQuantity("");
    setEditBillNumber("");
    alert("Dispatch updated successfully.");
  }

  function deleteDispatch(dispatchId: number) {
    const confirmed = window.confirm(
      "Delete this dispatch entry?"
    );

    if (!confirmed) return;

    setDispatches((current) =>
      current.filter(
        (dispatch) => dispatch.id !== dispatchId
      )
    );
  }

  function exportToExcel() {
    const rows = projects.flatMap((project) =>
      project.requirements.map((requirement) => {
        const dispatched = getAlreadyDispatched(
          project.id,
          requirement.material
        );
        const remaining = Math.max(
          0,
          requirement.required - dispatched
        );
        const status = getStatus(
          requirement.required,
          dispatched
        );

        return {
          Project: project.name,
          Customer: project.customer,
          Material: requirement.material,
          Required: requirement.required,
          Unit: requirement.unit,
          Dispatched: dispatched,
          Remaining: remaining,
          Status: status,
          BillNo: dispatches.find(
            (dispatch) =>
              dispatch.projectId === project.id &&
              dispatch.material === requirement.material
          )?.billNo || "",
        };
      })
    );

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Dispatch Summary"
    );
    XLSX.writeFile(workbook, "dispatch-summary.xlsx");
  }

  function addDispatch() {
    if (!dispatchProjectName.trim()) {
      alert("Please enter a project name.");
      return;
    }

    if (!dispatchMaterial) {
      alert("Please select a material.");
      return;
    }

    if (
      !dispatchQuantity ||
      Number(dispatchQuantity) <= 0
    ) {
      alert(
        "Please enter a valid dispatch quantity."
      );
      return;
    }

    if (!billNumber.trim()) {
      alert("Bill number is required.");
      return;
    }

    const projectId = dispatchProjectId
      ? Number(dispatchProjectId)
      : null;

    const selectedProject = projectId
      ? projects.find((p) => p.id === projectId)
      : undefined;

    const requirement = selectedProject
      ? getRequirement(projectId as number, dispatchMaterial)
      : undefined;

    if (selectedProject && !requirement) {
      alert(
        "This material is not required for this project."
      );
      return;
    }

    const quantity = Number(dispatchQuantity);

    if (selectedProject && requirement) {
      const alreadyDispatched =
        getAlreadyDispatched(
          projectId as number,
          dispatchMaterial
        );

      const remaining =
        requirement.required -
        alreadyDispatched;

      /* PREVENT OVER-DISPATCH */

      if (quantity > remaining) {
        alert(
          `Only ${remaining} ${requirement.unit} is remaining. You cannot dispatch ${quantity} ${requirement.unit}.`
        );

        return;
      }
    }

    const newDispatch: Dispatch = {
      id: Date.now(),

      date: new Date().toLocaleDateString(
        "en-GB",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      ),

      projectId,
      projectName: dispatchProjectName.trim(),
      customerName:
        dispatchCustomerName.trim() ||
        dispatchProjectName.trim(),
      material: dispatchMaterial,
      quantity,
      unit: requirement?.unit || "Nos",
      billNo: billNumber.trim(),
    };

    setDispatches([
      newDispatch,
      ...dispatches,
    ]);

    /* RESET FORM */

    setDispatchProjectName("");
    setDispatchCustomerName("");
    setDispatchProjectId("");
    setDispatchMaterial("");
    setDispatchQuantity("");
    setBillNumber("");

    alert("Dispatch saved successfully.");

    setActiveTab("Records");
  }

  /* --------------------------------------------------
     SELECTED DISPATCH INFORMATION
  -------------------------------------------------- */

  const selectedProject =
    projects.find(
      (p) =>
        p.id ===
        Number(dispatchProjectId)
    );

  const selectedRequirement =
    selectedProject?.requirements.find(
      (r) =>
        r.material === dispatchMaterial
    );

  const selectedAlreadyDispatched =
    selectedProject &&
    dispatchMaterial
      ? getAlreadyDispatched(
          selectedProject.id,
          dispatchMaterial
        )
      : 0;

  const selectedRemaining =
    selectedRequirement
      ? Math.max(
          0,
          selectedRequirement.required -
            selectedAlreadyDispatched
        )
      : 0;

  /* --------------------------------------------------
     DASHBOARD STATS
  -------------------------------------------------- */

  const projectSummary = useMemo(() => {
    return projects.map((project) => {
      const totalRequired = project.requirements.reduce(
        (sum, requirement) =>
          sum + requirement.required,
        0
      );

      const totalDispatched = project.requirements.reduce(
        (sum, requirement) =>
          sum +
          getAlreadyDispatched(
            project.id,
            requirement.material
          ),
        0
      );

      const totalRemaining = Math.max(
        0,
        totalRequired - totalDispatched
      );

      const completedCount = project.requirements.filter(
        (requirement) =>
          getAlreadyDispatched(
            project.id,
            requirement.material
          ) >= requirement.required
      ).length;

      const projectDispatchCount = dispatches.filter(
        (dispatch) =>
          dispatch.projectId === project.id
      ).length;

      return {
        project,
        totalRequired,
        totalDispatched,
        totalRemaining,
        completedCount,
        projectDispatchCount,
        completionPercent:
          project.requirements.length > 0
            ? Math.round(
                (completedCount /
                  project.requirements.length) *
                  100
              )
            : 100,
      };
    });
  }, [projects, dispatches]);

  const visibleRequirementItems = useMemo(() => {
    return projects
      .flatMap((project) =>
        project.requirements.map((requirement) => {
          const dispatched = getAlreadyDispatched(
            project.id,
            requirement.material
          );
          const remaining = Math.max(
            0,
            requirement.required - dispatched
          );
          const status =
            remaining <= 0 ? "Completed" : "Pending";

          return {
            project,
            requirement,
            dispatched,
            remaining,
            status,
          };
        })
      )
      .filter((item) => {
        if (materialViewFilter === "pending") {
          return item.status === "Pending";
        }

        if (materialViewFilter === "completed") {
          return item.status === "Completed";
        }

        return true;
      });
  }, [projects, dispatches, materialViewFilter]);

  const filteredDispatches = useMemo(() => {
    const query = recordSearch.trim().toLowerCase();

    return dispatches.filter((dispatch) => {
      const project = projects.find(
        (item) => item.id === dispatch.projectId
      );
      const requirement = project
        ? getRequirement(project.id, dispatch.material)
        : undefined;
      const totalDispatched =
        project && requirement
          ? getAlreadyDispatched(
              project.id,
              dispatch.material
            )
          : 0;
      const status = requirement
        ? getStatus(requirement.required, totalDispatched)
        : "Pending";

      const matchesSearch =
        !query ||
        dispatch.projectName.toLowerCase().includes(query) ||
        dispatch.customerName.toLowerCase().includes(query) ||
        dispatch.material.toLowerCase().includes(query) ||
        dispatch.billNo.toLowerCase().includes(query) ||
        (project?.name || "").toLowerCase().includes(query);

      const matchesStatus =
        recordStatusFilter === "all" ||
        (recordStatusFilter === "completed" && status === "Completed") ||
        (recordStatusFilter === "pending" && status === "Pending") ||
        (recordStatusFilter === "partial" && status === "Partially Dispatched");

      return matchesSearch && matchesStatus;
    });
  }, [dispatches, projects, recordSearch, recordStatusFilter]);

  const dashboardStats = useMemo(() => {
    let completed = 0;
    let partial = 0;
    let pending = 0;

    projects.forEach((project) => {
      project.requirements.forEach(
        (requirement) => {
          const dispatched =
            getAlreadyDispatched(
              project.id,
              requirement.material
            );

          const status = getStatus(
            requirement.required,
            dispatched
          );

          if (status === "Completed") {
            completed++;
          } else if (
            status ===
            "Partially Dispatched"
          ) {
            partial++;
          } else {
            pending++;
          }
        }
      );
    });

    return {
      projects: projects.length,
      dispatches: dispatches.length,
      completed,
      partial,
      pending,
    };
  }, [projects, dispatches]);

  /* --------------------------------------------------
     RENDER
  -------------------------------------------------- */

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-900">
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600 shadow-sm">
          Checking team access...
        </div>
      </main>
    );
  }

  if (!sessionUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-900">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Team access
            </p>
            <h1 className="mt-2 text-2xl font-bold">
              Dispatch Tracker
            </h1>
          </div>

          <div className="mb-5 flex rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setAuthMode("login")}
              className={`flex-1 rounded-md py-2 text-sm font-semibold ${
                authMode === "login"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setAuthMode("signup")}
              className={`flex-1 rounded-md py-2 text-sm font-semibold ${
                authMode === "signup"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              Create Account
            </button>
          </div>

          {authMode === "login" ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Username
                </label>
                <input
                  value={loginForm.username}
                  onChange={(event) =>
                    setLoginForm((current) => ({
                      ...current,
                      username: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-0 focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Password
                </label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-0 focus:border-slate-500"
                />
              </div>

              {loginError ? (
                <p className="text-sm text-red-600">{loginError}</p>
              ) : null}

              <button
                type="submit"
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Sign in to team tracker
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Choose a username
                </label>
                <input
                  value={signupForm.username}
                  onChange={(event) =>
                    setSignupForm((current) => ({
                      ...current,
                      username: event.target.value,
                    }))
                  }
                  placeholder="e.g. rahul"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-0 focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Choose a password
                </label>
                <input
                  type="password"
                  value={signupForm.password}
                  onChange={(event) =>
                    setSignupForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  placeholder="At least 8 characters"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-0 focus:border-slate-500"
                />
              </div>

              {signupError ? (
                <p className="text-sm text-red-600">{signupError}</p>
              ) : null}

              <button
                type="submit"
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Create account
              </button>
            </form>
          )}

        
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">

      {/* HEADER */}

      <header className="border-b bg-white">

        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <div>
            <h1 className="text-2xl font-bold">
              Dispatch Tracker
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Material dispatch & pending management
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {sessionUser}
            </span>

            <button
              onClick={exportToExcel}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              Export XLSX
            </button>

            <button
              onClick={() =>
                setTheme(
                  theme === "dark" ? "light" : "dark"
                )
              }
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
            </button>

            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              Logout
            </button>

            <button
              onClick={() =>
                setActiveTab("New Dispatch")
              }
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
            >
              + New Dispatch
            </button>
          </div>

        </div>

      </header>

      {/* NAVIGATION */}

      <nav className="border-b bg-white">

        <div className="mx-auto flex max-w-7xl gap-8 px-6">

          {[
            "Dashboard",
            "Projects",
            "New Dispatch",
            "Records",
          ].map((tab) => (

            <button
              key={tab}
              onClick={() =>
                setActiveTab(tab)
              }
              className={`border-b-2 py-4 text-sm font-medium ${
                activeTab === tab
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500"
              }`}
            >
              {tab}
            </button>

          ))}

        </div>

      </nav>

      {/* CONTENT */}

      <div className="mx-auto max-w-7xl px-6 py-8">

        {/* ==================================================
            DASHBOARD
        ================================================== */}

        {activeTab === "Dashboard" && (
          <>

            <div className="mb-8">

              <h2 className="text-xl font-bold">
                Dispatch Overview
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Track project requirements,
                dispatches and pending materials.
              </p>

            </div>

            {/* STATS */}

            <div className="grid gap-5 md:grid-cols-5">

              <Stat
                title="Projects"
                value={dashboardStats.projects}
              />

              <Stat
                title="Dispatches"
                value={dashboardStats.dispatches}
              />

              <Stat
                title="Completed"
                value={dashboardStats.completed}
              />

              <Stat
                title="Partially Dispatched"
                value={dashboardStats.partial}
              />

              <Stat
                title="Pending"
                value={dashboardStats.pending}
              />

            </div>

            <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "all", label: "All" },
                  { key: "pending", label: "Pending" },
                  { key: "completed", label: "Completed" },
                ].map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() =>
                      setMaterialViewFilter(
                        filter.key as "all" | "pending" | "completed"
                      )
                    }
                    className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                      materialViewFilter === filter.key
                        ? "bg-slate-900 text-white"
                        : "bg-white text-slate-700"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              <select
                className="input max-w-xs"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
              >
                <option value="all">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.name}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            {/* PENDING MATERIALS */}

            <div className="mt-4 overflow-hidden rounded-xl border bg-white">

              <div className="border-b px-6 py-5">

                <h3 className="font-semibold">
                  Pending Materials
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Materials that still require dispatch.
                </p>

              </div>

              <div className="divide-y">

                {visibleRequirementItems
                  .filter((item) => item.remaining > 0 || materialViewFilter === "completed")
                  .map((item) => (

                    <div
                      key={`${item.project.id}-${item.requirement.material}`}
                      className="flex items-center justify-between px-6 py-5"
                    >

                      <div>

                        <p className="font-semibold">
                          {item.project.name}
                        </p>

                        <p className="text-sm text-slate-500">
                          {item.requirement.material}
                        </p>

                      </div>

                      <div className="text-right">

                        <p className="font-bold text-red-600">
                          {item.remaining}{" "}
                          {item.requirement.unit}
                        </p>

                        <p className="text-xs text-slate-400">
                          remaining
                        </p>

                      </div>

                    </div>

                  ))}

              </div>

            </div>

          </>
        )}

        {/* ==================================================
            PROJECTS
        ================================================== */}

        {activeTab === "Projects" && (
          <>

            <div className="mb-8 flex items-center justify-between">

              <div>

                <h2 className="text-xl font-bold">
                  Projects
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Set the required materials and
                  quantities for each project.
                </p>

              </div>

              <button
                onClick={() =>
                  setShowProjectForm(
                    !showProjectForm
                  )
                }
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
              >
                + New Project
              </button>

            </div>

            {/* CREATE PROJECT */}

            {showProjectForm && (
              <div className="mb-8 rounded-xl border bg-white p-6">

                <h3 className="text-lg font-semibold">
                  Create Project
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Enter requirements here. These
                  quantities will NOT need to be
                  entered again during dispatch.
                </p>

                {/* PROJECT DETAILS */}

                <div className="mt-6 grid gap-5 md:grid-cols-2">

                  <FormField label="Project Name">

                    <input
                      className="input"
                      placeholder="e.g. Sharma Residence"
                      value={projectName}
                      onChange={(e) =>
                        setProjectName(
                          e.target.value
                        )
                      }
                    />

                  </FormField>

                  <FormField label="Customer">

                    <input
                      className="input"
                      placeholder="e.g. Mr. Sharma"
                      value={customerName}
                      onChange={(e) =>
                        setCustomerName(
                          e.target.value
                        )
                      }
                    />

                  </FormField>

                </div>

                {/* REQUIREMENTS */}

                <div className="mt-8">

                  <div className="mb-4 flex items-center justify-between">

                    <div>

                      <h4 className="font-semibold">
                        Material Requirements
                      </h4>

                      <p className="text-sm text-slate-500">
                        Enter how much material is
                        required for this project.
                      </p>

                    </div>

                    <button
                      onClick={
                        addMaterialRequirement
                      }
                      className="text-sm font-semibold text-slate-700"
                    >
                      + Add Material
                    </button>

                  </div>

                  <div className="space-y-3">

                    {requirements.map(
                      (requirement, index) => (

                        <div
                          key={index}
                          className="grid gap-3 md:grid-cols-[1fr_180px_150px_auto]"
                        >

                          <select
                            className="input"
                            value={
                              requirement.material
                            }
                            onChange={(e) =>
                              updateRequirement(
                                index,
                                "material",
                                e.target.value
                              )
                            }
                          >

                            {MATERIALS.map(
                              (material) => (
                                <option
                                  key={material}
                                  value={material}
                                >
                                  {material}
                                </option>
                              )
                            )}

                          </select>

                          <input
                            type="number"
                            min="0"
                            className="input"
                            placeholder="Required Qty"
                            value={
                              requirement.required ||
                              ""
                            }
                            onChange={(e) =>
                              updateRequirement(
                                index,
                                "required",
                                Number(
                                  e.target.value
                                )
                              )
                            }
                          />

                          <select
                            className="input"
                            value={
                              requirement.unit
                            }
                            onChange={(e) =>
                              updateRequirement(
                                index,
                                "unit",
                                e.target.value
                              )
                            }
                          >

                            {UNITS.map(
                              (unit) => (
                                <option
                                  key={unit}
                                  value={unit}
                                >
                                  {unit}
                                </option>
                              )
                            )}

                          </select>

                          <button
                            onClick={() =>
                              removeRequirement(
                                index
                              )
                            }
                            className="rounded-lg border px-4 text-sm text-red-600"
                          >
                            Remove
                          </button>

                        </div>

                      )
                    )}

                  </div>

                </div>

                <button
                  onClick={createProject}
                  className="mt-6 rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white"
                >
                  Create Project
                </button>

              </div>
            )}

            {/* PROJECT SUMMARY */}

            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              {projectSummary.map((summary) => (
                <div
                  key={summary.project.id}
                  className="rounded-xl border bg-white p-5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">
                        {summary.project.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {summary.project.customer}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                      {summary.completionPercent}% complete
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">
                        Required
                      </p>
                      <p className="mt-1 font-semibold">
                        {summary.totalRequired}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">
                        Dispatched
                      </p>
                      <p className="mt-1 font-semibold">
                        {summary.totalDispatched}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">
                        Remaining
                      </p>
                      <p className="mt-1 font-semibold text-red-600">
                        {summary.totalRemaining}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">
                        Entries
                      </p>
                      <p className="mt-1 font-semibold">
                        {summary.projectDispatchCount}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* PROJECT LIST */}

            <div className="grid gap-5 md:grid-cols-2">

              {projects.map((project) => {

                const completed =
                  project.requirements.filter(
                    (requirement) => {

                      const dispatched =
                        getAlreadyDispatched(
                          project.id,
                          requirement.material
                        );

                      return (
                        dispatched >=
                        requirement.required
                      );
                    }
                  ).length;

                return (

                  <div
                    key={project.id}
                    className="rounded-xl border bg-white p-6"
                  >

                    <div className="flex items-start justify-between">

                      <div>

                        <h3 className="font-bold">
                          {project.name}
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          {project.customer}
                        </p>

                      </div>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                        {completed}/
                        {project.requirements.length}
                        {" "}Complete
                      </span>

                    </div>

                    <div className="mt-6 space-y-3">

                      {project.requirements.map(
                        (requirement) => {

                          const dispatched =
                            getAlreadyDispatched(
                              project.id,
                              requirement.material
                            );

                          const remaining =
                            Math.max(
                              0,
                              requirement.required -
                                dispatched
                            );

                          const status =
                            getStatus(
                              requirement.required,
                              dispatched
                            );

                          return (

                            <div
                              key={
                                requirement.material
                              }
                              className="rounded-lg bg-slate-50 p-4"
                            >

                              <div className="flex items-center justify-between">

                                <div>

                                  <p className="font-semibold">
                                    {
                                      requirement.material
                                    }
                                  </p>

                                  <p className="text-xs text-slate-500">
                                    Required:{" "}
                                    {
                                      requirement.required
                                    }{" "}
                                    {
                                      requirement.unit
                                    }
                                  </p>

                                </div>

                                <div className="text-right">

                                  <p className="font-bold">
                                    {dispatched} /{" "}
                                    {
                                      requirement.required
                                    }
                                  </p>

                                  <p
                                    className={`text-xs font-semibold ${
                                      status ===
                                      "Completed"
                                        ? "text-green-600"
                                        : status ===
                                          "Partially Dispatched"
                                        ? "text-yellow-600"
                                        : "text-red-600"
                                    }`}
                                  >
                                    {status}
                                  </p>

                                </div>

                              </div>

                              {remaining > 0 && (
                                <p className="mt-2 text-xs text-red-600">
                                  {remaining}{" "}
                                  {
                                    requirement.unit
                                  } remaining
                                </p>
                              )}

                            </div>

                          );
                        }
                      )}

                    </div>

                  </div>

                );
              })}

            </div>

          </>
        )}

        {/* ==================================================
            NEW DISPATCH
        ================================================== */}

        {activeTab === "New Dispatch" && (
          <div className="mx-auto max-w-3xl">

            <div className="mb-8">

              <h2 className="text-xl font-bold">
                Add New Dispatch
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Enter only what is shown on the dispatch bill.
              </p>

            </div>

            <div className="rounded-xl border bg-white p-6">

              <div className="space-y-5">

                {/* PROJECT */}

                <FormField label="Project">

                  <input
                    className="input"
                    placeholder="Type any project name"
                    value={dispatchProjectName}
                    onChange={(e) =>
                      handleProjectChange(
                        e.target.value
                      )
                    }
                    onBlur={handleCustomerAutoFill}
                    list="project-suggestions"
                  />

                  <datalist id="project-suggestions">
                    {projects.map((project) => (
                      <option
                        key={project.id}
                        value={project.name}
                      />
                    ))}
                  </datalist>

                </FormField>

                <FormField label="Customer">

                  <input
                    className="input"
                    placeholder="Type customer name"
                    value={dispatchCustomerName}
                    onChange={(e) =>
                      setDispatchCustomerName(
                        e.target.value
                      )
                    }
                  />

                </FormField>

                {/* MATERIAL */}

                <FormField label="Material">

                  <select
                    className="input"
                    value={dispatchMaterial}
                    onChange={(e) =>
                      handleMaterialChange(
                        e.target.value
                      )
                    }
                  >

                    <option value="">
                      Select Material
                    </option>

                    {selectedProject
                      ? selectedProject.requirements.map(
                          (requirement) => (
                            <option
                              key={
                                requirement.material
                              }
                              value={
                                requirement.material
                              }
                            >
                              {
                                requirement.material
                              }
                            </option>
                          )
                        )
                      : MATERIALS.map((material) => (
                          <option
                            key={material}
                            value={material}
                          >
                            {material}
                          </option>
                        ))}

                  </select>

                </FormField>

                {/* AUTOMATIC REQUIREMENT INFO */}

                {selectedRequirement && (
                  <div className="rounded-xl bg-slate-50 p-5">

                    <div className="grid grid-cols-3 gap-4 text-center">

                      <div>

                        <p className="text-xs text-slate-500">
                          Required
                        </p>

                        <p className="mt-1 font-bold">
                          {
                            selectedRequirement.required
                          }{" "}
                          {
                            selectedRequirement.unit
                          }
                        </p>

                      </div>

                      <div>

                        <p className="text-xs text-slate-500">
                          Already Dispatched
                        </p>

                        <p className="mt-1 font-bold">
                          {
                            selectedAlreadyDispatched
                          }{" "}
                          {
                            selectedRequirement.unit
                          }
                        </p>

                      </div>

                      <div>

                        <p className="text-xs text-slate-500">
                          Remaining
                        </p>

                        <p className="mt-1 font-bold text-red-600">
                          {selectedRemaining}{" "}
                          {
                            selectedRequirement.unit
                          }
                        </p>

                      </div>

                    </div>

                  </div>
                )}

                {/* DISPATCH QUANTITY */}

                <FormField label="Dispatch Quantity">

                  <input
                    type="number"
                    min="1"
                    className="input"
                    placeholder={
                      selectedRequirement
                        ? `Maximum ${selectedRemaining}`
                        : "Enter quantity"
                    }
                    value={dispatchQuantity}
                    onChange={(e) =>
                      setDispatchQuantity(
                        e.target.value
                      )
                    }
                  />

                </FormField>

                {/* UNIT - AUTOMATIC */}

                {selectedRequirement && (
                  <FormField label="Unit">

                    <input
                      className="input bg-slate-50"
                      value={
                        selectedRequirement.unit
                      }
                      disabled
                    />

                  </FormField>
                )}

                {/* BILL NUMBER */}

                <FormField label="Bill Number">

                  <input
                    className="input"
                    placeholder="e.g. BILL-1025"
                    value={billNumber}
                    onChange={(e) =>
                      setBillNumber(
                        e.target.value
                      )
                    }
                  />

                </FormField>

                {/* PREVIEW */}

                {selectedRequirement &&
                  dispatchQuantity &&
                  Number(dispatchQuantity) > 0 && (
                    <div className="rounded-xl border p-5">

                      <p className="mb-3 text-sm font-semibold">
                        Dispatch Preview
                      </p>

                      <div className="grid grid-cols-2 gap-3 text-sm">

                        <span>
                          This Dispatch
                        </span>

                        <span className="text-right font-semibold">
                          {dispatchQuantity}{" "}
                          {
                            selectedRequirement.unit
                          }
                        </span>

                        <span>
                          Remaining After Dispatch
                        </span>

                        <span className="text-right font-semibold">
                          {Math.max(
                            0,
                            selectedRemaining -
                              Number(
                                dispatchQuantity
                              )
                          )}{" "}
                          {
                            selectedRequirement.unit
                          }
                        </span>

                      </div>

                    </div>
                  )}

                {/* SAVE */}

                <button
                  onClick={addDispatch}
                  className="w-full rounded-lg bg-slate-900 py-3 font-semibold text-white hover:bg-slate-800"
                >
                  Save Dispatch
                </button>

              </div>

            </div>

          </div>
        )}

        {/* ==================================================
            RECORDS
        ================================================== */}

        {activeTab === "Records" && (
          <>

            <div className="mb-8">

              <h2 className="text-xl font-bold">
                Dispatch Records
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                All dispatch bills recorded by the team.
              </p>

            </div>

            {editingDispatch && (
              <div className="mb-6 rounded-xl border bg-slate-50 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">
                      Edit Dispatch
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Update the entry and keep the requirement balance accurate.
                    </p>
                  </div>
                  <button
                    onClick={cancelEditDispatch}
                    className="text-sm font-semibold text-slate-600"
                  >
                    Cancel
                  </button>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <FormField label="Project">
                    <input
                      className="input"
                      value={editProjectName}
                      onChange={(e) =>
                        setEditProjectName(e.target.value)
                      }
                      placeholder="Project name"
                    />
                  </FormField>

                  <FormField label="Customer">
                    <input
                      className="input"
                      value={editCustomerName}
                      onChange={(e) =>
                        setEditCustomerName(e.target.value)
                      }
                      placeholder="Customer name"
                    />
                  </FormField>

                  <FormField label="Material">
                    <select
                      className="input"
                      value={editMaterial}
                      onChange={(e) =>
                        setEditMaterial(e.target.value)
                      }
                    >
                      {MATERIALS.map((material) => (
                        <option key={material} value={material}>
                          {material}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Quantity">
                    <input
                      type="number"
                      min="1"
                      className="input"
                      value={editQuantity}
                      onChange={(e) =>
                        setEditQuantity(e.target.value)
                      }
                    />
                  </FormField>

                  <FormField label="Bill Number">
                    <input
                      className="input"
                      value={editBillNumber}
                      onChange={(e) =>
                        setEditBillNumber(e.target.value)
                      }
                      placeholder="Bill number"
                    />
                  </FormField>
                </div>

                <button
                  onClick={saveEditedDispatch}
                  className="mt-4 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Save Changes
                </button>
              </div>
            )}

            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="w-full md:max-w-sm">
                <input
                  className="input"
                  placeholder="Search project, material, bill no."
                  value={recordSearch}
                  onChange={(e) =>
                    setRecordSearch(e.target.value)
                  }
                />
              </div>

              <div className="flex gap-2">
                {[
                  { key: "all", label: "All" },
                  { key: "pending", label: "Pending" },
                  { key: "partial", label: "Partial" },
                  { key: "completed", label: "Completed" },
                ].map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() =>
                      setRecordStatusFilter(
                        filter.key as
                          | "all"
                          | "completed"
                          | "pending"
                          | "partial"
                      )
                    }
                    className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                      recordStatusFilter === filter.key
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border bg-white">

              <div className="overflow-x-auto">

                <table className="w-full text-left text-sm">

                  <thead className="border-b bg-slate-50">

                    <tr>

                      <th className="px-5 py-4">
                        Date
                      </th>

                      <th className="px-5 py-4">
                        Project
                      </th>

                      <th className="px-5 py-4">
                        Material
                      </th>

                      <th className="px-5 py-4">
                        Bill No.
                      </th>

                      <th className="px-5 py-4">
                        Dispatched
                      </th>

                      <th className="px-5 py-4">
                        Remaining
                      </th>

                      <th className="px-5 py-4">
                        Status
                      </th>

                      <th className="px-5 py-4">
                        Actions
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y">

                    {filteredDispatches.map(
                      (dispatch) => {

                        const project =
                          projects.find(
                            (p) =>
                              p.id ===
                              dispatch.projectId
                          );

                        const requirement =
                          project
                            ? getRequirement(
                                project.id,
                                dispatch.material
                              )
                            : undefined;

                        const totalDispatched =
                          dispatch.projectId !== null
                            ? getAlreadyDispatched(
                                dispatch.projectId,
                                dispatch.material
                              )
                            : 0;

                        const remaining =
                          requirement
                            ? Math.max(
                                0,
                                requirement.required -
                                  totalDispatched
                              )
                            : 0;

                        const status =
                          requirement
                            ? getStatus(
                                requirement.required,
                                totalDispatched
                              )
                            : "Pending";

                        return (

                          <tr
                            key={dispatch.id}
                            className="hover:bg-slate-50"
                          >

                            <td className="px-5 py-4">
                              {dispatch.date}
                            </td>

                            <td className="px-5 py-4 font-medium">
                              <div>
                                {dispatch.projectName ||
                                  project?.name ||
                                  "Custom Project"}
                              </div>
                              {dispatch.customerName && (
                                <div className="text-xs text-slate-400">
                                  {dispatch.customerName}
                                </div>
                              )}
                            </td>

                            <td className="px-5 py-4">
                              {dispatch.material}
                            </td>

                            <td className="px-5 py-4">
                              {dispatch.billNo}
                            </td>

                            <td className="px-5 py-4 font-semibold">
                              {dispatch.quantity}{" "}
                              {dispatch.unit}
                            </td>

                            <td className="px-5 py-4">
                              {remaining}{" "}
                              {requirement?.unit}
                            </td>

                            <td className="px-5 py-4">

                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  status ===
                                  "Completed"
                                    ? "bg-green-100 text-green-700"
                                    : status ===
                                      "Partially Dispatched"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {status}
                              </span>

                            </td>

                            <td className="px-5 py-4">
                              <div className="flex gap-2">
                                <button
                                  onClick={() =>
                                    startEditDispatch(dispatch)
                                  }
                                  className="rounded border px-3 py-1 text-xs font-semibold text-slate-700"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() =>
                                    deleteDispatch(dispatch.id)
                                  }
                                  className="rounded border px-3 py-1 text-xs font-semibold text-red-600"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>

                          </tr>

                        );
                      }
                    )}

                  </tbody>

                </table>

              </div>

            </div>

            {filteredDispatches.length === 0 && (
              <div className="mt-4 rounded-xl border border-dashed bg-white p-6 text-center text-sm text-slate-500">
                No dispatch records match the current search or filter.
              </div>
            )}

          </>
        )}

      </div>

    </main>
  );
}

/* ======================================================
   SMALL COMPONENTS
====================================================== */

function Stat({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border bg-white p-5">

      <p className="text-sm text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold">
        {value}
      </p>

    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>

      <label className="mb-2 block text-sm font-medium">
        {label}
      </label>

      {children}

    </div>
  );
}
