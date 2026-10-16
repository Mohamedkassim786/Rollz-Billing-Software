import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Sliders,
  Edit2,
  Trash2,
  AlertCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { modifierApi, ModifierGroup, ModifierOption } from "../api/modifiers.api";
import { Badge } from "../components/Common/Badge";
import { ConfirmModal } from "../components/Common/ConfirmModal";
import { formatPaise, paiseToRupees, rupeesToPaise } from "../utils/currency";

export const ModifiersPage: React.FC = () => {
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ModifierGroup | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Group modal
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupType, setGroupType] = useState<"SINGLE" | "MULTIPLE">("SINGLE");
  const [groupIsRequired, setGroupIsRequired] = useState(false);
  const [groupMin, setGroupMin] = useState(0);
  const [groupMax, setGroupMax] = useState(1);
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  // Option modal
  const [isOptionModalOpen, setIsOptionModalOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<ModifierOption | null>(null);
  const [optionName, setOptionName] = useState("");
  const [optionDescription, setOptionDescription] = useState("");
  const [optionExtraPriceRupees, setOptionExtraPriceRupees] = useState<number | string>(0);
  const [optionIsAvailable, setOptionIsAvailable] = useState(true);
  const [isSavingOption, setIsSavingOption] = useState(false);

  // Delete modal
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<ModifierGroup | null>(null);
  const [deleteOptionTarget, setDeleteOptionTarget] = useState<ModifierOption | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchGroups = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await modifierApi.listGroups({ includeInactive: true });
      setGroups(data);
      if (data.length > 0) {
        setSelectedGroup((prev) => {
          if (!prev) return data[0];
          const found = data.find((g) => g.id === prev.id);
          return found || data[0];
        });
      } else {
        setSelectedGroup(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to load modifier groups");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Group Form handlers
  const handleOpenAddGroup = () => {
    setEditingGroup(null);
    setGroupName("");
    setGroupDescription("");
    setGroupType("SINGLE");
    setGroupIsRequired(false);
    setGroupMin(0);
    setGroupMax(1);
    setIsGroupModalOpen(true);
  };

  const handleOpenEditGroup = (g: ModifierGroup) => {
    setEditingGroup(g);
    setGroupName(g.name);
    setGroupDescription(g.description || "");
    setGroupType(g.selectionType);
    setGroupIsRequired(g.isRequired);
    setGroupMin(g.minSelections);
    setGroupMax(g.maxSelections);
    setIsGroupModalOpen(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    setIsSavingGroup(true);
    setError(null);
    try {
      if (editingGroup) {
        await modifierApi.updateGroup(editingGroup.id, {
          name: groupName.trim(),
          description: groupDescription.trim() || null,
          selectionType: groupType,
          isRequired: groupIsRequired,
          minSelections: groupType === "SINGLE" ? (groupIsRequired ? 1 : 0) : groupMin,
          maxSelections: groupType === "SINGLE" ? 1 : groupMax,
        });
      } else {
        await modifierApi.createGroup({
          name: groupName.trim(),
          description: groupDescription.trim() || undefined,
          selectionType: groupType,
          isRequired: groupIsRequired,
          minSelections: groupType === "SINGLE" ? (groupIsRequired ? 1 : 0) : groupMin,
          maxSelections: groupType === "SINGLE" ? 1 : groupMax,
        });
      }
      setIsGroupModalOpen(false);
      fetchGroups();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to save modifier group");
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleDeleteGroupConfirm = async () => {
    if (!deleteGroupTarget) return;
    setIsDeleting(true);
    try {
      await modifierApi.deleteGroup(deleteGroupTarget.id);
      setDeleteGroupTarget(null);
      fetchGroups();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to delete modifier group");
    } finally {
      setIsDeleting(false);
    }
  };

  // Option Form handlers
  const handleOpenAddOption = () => {
    if (!selectedGroup) return;
    setEditingOption(null);
    setOptionName("");
    setOptionDescription("");
    setOptionExtraPriceRupees(0);
    setOptionIsAvailable(true);
    setIsOptionModalOpen(true);
  };

  const handleOpenEditOption = (opt: ModifierOption) => {
    setEditingOption(opt);
    setOptionName(opt.name);
    setOptionDescription(opt.description || "");
    setOptionExtraPriceRupees(paiseToRupees(opt.extraPrice));
    setOptionIsAvailable(opt.isAvailable);
    setIsOptionModalOpen(true);
  };

  const handleSaveOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !optionName.trim()) return;

    const numRupees =
      typeof optionExtraPriceRupees === "string"
        ? parseFloat(optionExtraPriceRupees)
        : optionExtraPriceRupees;

    if (isNaN(numRupees) || numRupees < 0) {
      setError("Extra price cannot be negative");
      return;
    }

    const extraPricePaise = rupeesToPaise(numRupees);

    setIsSavingOption(true);
    setError(null);
    try {
      if (editingOption) {
        await modifierApi.updateOption(editingOption.id, {
          name: optionName.trim(),
          description: optionDescription.trim() || null,
          extraPrice: extraPricePaise,
          isAvailable: optionIsAvailable,
        });
      } else {
        await modifierApi.addOption(selectedGroup.id, {
          name: optionName.trim(),
          description: optionDescription.trim() || undefined,
          extraPrice: extraPricePaise,
          isAvailable: optionIsAvailable,
          displayOrder: selectedGroup.options.length,
        });
      }
      setIsOptionModalOpen(false);
      fetchGroups();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to save modifier option");
    } finally {
      setIsSavingOption(false);
    }
  };

  const handleDeleteOptionConfirm = async () => {
    if (!selectedGroup || !deleteOptionTarget) return;
    setIsDeleting(true);
    try {
      await modifierApi.deleteOption(deleteOptionTarget.id);
      setDeleteOptionTarget(null);
      fetchGroups();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to delete modifier option");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Add Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#172033] tracking-tight flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-[#2563EB]" />
            <span>Modifiers & Add-ons</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1">
            Configure customizations and additional charges.
          </p>
        </div>

        <button
          onClick={handleOpenAddGroup}
          className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Modifier Group</span>
        </button>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-700">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-700 hover:text-red-900 font-bold ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Content Layout: Left Groups Navigation + Right Options Manager */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-14 bg-white border border-[#E2E8F0] rounded-2xl text-[#64748B] gap-3 shadow-card">
          <RefreshCw className="w-6 h-6 animate-spin text-[#2563EB]" />
          <p className="text-xs font-semibold">Loading modifiers from PostgreSQL...</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-14 bg-white border border-[#E2E8F0] rounded-2xl text-[#64748B] gap-3 text-center shadow-card">
          <Sliders className="w-10 h-10 text-slate-300" />
          <p className="text-sm font-bold text-[#172033]">No modifier groups created yet</p>
          <p className="text-xs text-[#64748B] max-w-sm">
            Create your first modifier group (such as Spice Level, Cheese Upgrades, or Extra Sauces) using the button above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Groups List */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Groups ({groups.length})
              </span>
              <button
                onClick={fetchGroups}
                className="text-slate-500 hover:text-[#2563EB] p-1 rounded-lg transition-colors cursor-pointer"
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {groups.map((group) => {
                const isSelected = selectedGroup?.id === group.id;

                return (
                  <div
                    key={group.id}
                    onClick={() => setSelectedGroup(group)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                      isSelected
                        ? "bg-blue-50/60 border-[#2563EB] shadow-sm"
                        : "bg-white border-[#E2E8F0] hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3
                            className={`text-sm font-bold ${
                              isSelected ? "text-[#2563EB]" : "text-[#172033]"
                            }`}
                          >
                            {group.name}
                          </h3>
                          <Badge
                            variant={group.selectionType === "SINGLE" ? "info" : "warning"}
                            size="sm"
                          >
                            {group.selectionType}
                          </Badge>
                        </div>
                        {group.description && (
                          <p className="text-xs text-[#64748B] line-clamp-1">{group.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditGroup(group);
                          }}
                          className="p-1.5 text-slate-400 hover:text-[#2563EB] hover:bg-white rounded-lg transition-colors cursor-pointer"
                          title="Edit Group"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteGroupTarget(group);
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                          title="Delete Group"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-[#64748B]">
                      <span>
                        Rule:{" "}
                        <strong className="text-[#172033]">
                          {group.isRequired ? "Required" : "Optional"}
                        </strong>
                        {group.selectionType === "MULTIPLE" && (
                          <span>
                            {" "}
                            (Min {group.minSelections}, Max {group.maxSelections})
                          </span>
                        )}
                      </span>
                      <span className="font-semibold text-[#2563EB]">
                        {group.options.length} {group.options.length === 1 ? "option" : "options"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected Group Options Manager */}
          <div className="lg:col-span-7">
            {selectedGroup ? (
              <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-card space-y-6">
                {/* Header with Title & Add Option Button */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black text-[#172033]">{selectedGroup.name}</h2>
                      <Badge variant="neutral" size="sm">
                        {selectedGroup.options.length} Options
                      </Badge>
                    </div>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      {selectedGroup.description || "Customizable choices for this modifier group"}
                    </p>
                  </div>

                  <button
                    onClick={handleOpenAddOption}
                    className="flex items-center gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Option</span>
                  </button>
                </div>

                {/* Options Table */}
                {selectedGroup.options.length === 0 ? (
                  <div className="text-center py-12 text-[#64748B] space-y-2">
                    <p className="text-xs font-semibold text-[#172033]">No options in this group</p>
                    <p className="text-[11px]">
                      Add individual choices (e.g. Mild, Spicy, Extra Melted Cheese).
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F8FAFC] border-y border-[#E2E8F0] text-[#64748B] font-bold uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3">Option Name</th>
                          <th className="py-2.5 px-3 font-mono">Extra Price</th>
                          <th className="py-2.5 px-3 text-center">Availability</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {selectedGroup.options.map((opt) => (
                          <tr key={opt.id} className="hover:bg-[#F8FAFC] transition-colors">
                            <td className="py-3 px-3 font-semibold text-[#172033]">
                              <span>{opt.name}</span>
                              {opt.description && (
                                <span className="block text-[11px] text-slate-400 font-normal">
                                  {opt.description}
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3 font-mono font-bold text-[#172033]">
                              {opt.extraPrice === 0 ? (
                                <span className="text-slate-400 font-normal">Free (₹0.00)</span>
                              ) : (
                                <span className="text-[#16A34A]">+{formatPaise(opt.extraPrice)}</span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-center">
                              <Badge variant={opt.isAvailable ? "success" : "neutral"} size="sm">
                                {opt.isAvailable ? "In Stock" : "Unavailable"}
                              </Badge>
                            </td>

                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenEditOption(opt)}
                                  className="p-1.5 text-slate-400 hover:text-[#2563EB] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                  title="Edit Option"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeleteOptionTarget(opt)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete Option"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-[#E2E8F0] rounded-3xl p-12 text-center text-[#64748B] shadow-card">
                <p className="text-xs">Select a modifier group from the left to view options.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Modifier Group Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-[#2563EB] border border-blue-100">
                  <Sliders className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-[#172033]">
                  {editingGroup ? "Edit Modifier Group" : "Add Modifier Group"}
                </h3>
              </div>
              <button
                onClick={() => setIsGroupModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172033]">Group Name *</label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Spice Level, Extra Cheese, Sauce Choice"
                  className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172033]">Description</label>
                <textarea
                  rows={2}
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="Optional instructions for cashier or customer"
                  className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all resize-none"
                />
              </div>

              {/* Selection Type: Single vs Multiple */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172033]">Selection Rule</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setGroupType("SINGLE");
                      setGroupMax(1);
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      groupType === "SINGLE"
                        ? "bg-blue-50 text-[#2563EB] border-[#2563EB]"
                        : "bg-[#F8FAFC] text-[#64748B] border-slate-200"
                    }`}
                  >
                    Single Choice (Radio)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGroupType("MULTIPLE");
                      if (groupMax <= 1) setGroupMax(5);
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      groupType === "MULTIPLE"
                        ? "bg-blue-50 text-[#2563EB] border-[#2563EB]"
                        : "bg-[#F8FAFC] text-[#64748B] border-slate-200"
                    }`}
                  >
                    Multiple Choice (Checkbox)
                  </button>
                </div>
              </div>

              {/* Required & Min/Max */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2 p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupIsRequired}
                    onChange={(e) => setGroupIsRequired(e.target.checked)}
                    className="rounded text-[#2563EB] focus:ring-blue-100"
                  />
                  <span className="font-semibold">Required Choice</span>
                </label>

                {groupType === "MULTIPLE" && (
                  <div className="flex items-center gap-2">
                    <div className="space-y-0.5 flex-1">
                      <span className="text-[10px] text-slate-500 font-bold">Max Allowed</span>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={groupMax}
                        onChange={(e) => setGroupMax(parseInt(e.target.value) || 1)}
                        className="w-full px-2.5 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  disabled={isSavingGroup}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingGroup}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSavingGroup ? "Saving..." : editingGroup ? "Update Group" : "Save Group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Modifier Option Modal */}
      {isOptionModalOpen && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-[#2563EB] border border-blue-100">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#172033]">
                    {editingOption ? "Edit Option" : "Add Option"}
                  </h3>
                  <p className="text-[11px] text-[#64748B]">Group: {selectedGroup.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsOptionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOption} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172033]">Option Name *</label>
                <input
                  type="text"
                  required
                  value={optionName}
                  onChange={(e) => setOptionName(e.target.value)}
                  placeholder="e.g. Extra Cheddar, Jalapeños, Mint Mayo"
                  className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172033]">
                  Extra Price (₹ INR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={optionExtraPriceRupees}
                  onChange={(e) => setOptionExtraPriceRupees(e.target.value)}
                  placeholder="0.00 for free options"
                  className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs font-mono font-bold text-[#172033] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
                />
                <span className="text-[10px] text-slate-400">
                  Enter 0 for choices included at no extra cost
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172033]">Description</label>
                <input
                  type="text"
                  value={optionDescription}
                  onChange={(e) => setOptionDescription(e.target.value)}
                  placeholder="Optional note"
                  className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOptionModalOpen(false)}
                  disabled={isSavingOption}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingOption}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSavingOption ? "Saving..." : editingOption ? "Update Option" : "Add Option"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Group Modal */}
      <ConfirmModal
        isOpen={!!deleteGroupTarget}
        title="Delete Modifier Group"
        message={`Are you sure you want to delete "${deleteGroupTarget?.name}" and all of its options?`}
        confirmLabel="Delete Group"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDeleteGroupConfirm}
        onCancel={() => setDeleteGroupTarget(null)}
      />

      {/* Delete Option Modal */}
      <ConfirmModal
        isOpen={!!deleteOptionTarget}
        title="Delete Modifier Option"
        message={`Are you sure you want to delete option "${deleteOptionTarget?.name}"?`}
        confirmLabel="Delete Option"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDeleteOptionConfirm}
        onCancel={() => setDeleteOptionTarget(null)}
      />
    </div>
  );
};
