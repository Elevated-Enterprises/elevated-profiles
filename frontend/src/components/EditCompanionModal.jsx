import { useState, useRef } from 'react'
import ModalBase from './ModalBase'
import { createCompanion, updateCompanion, uploadCompanionImage, deleteCompanionImage, getImageUrl } from '../lib/api'

const VISIBILITY_OPTIONS = [
  { value: 0, label: 'Private' },
  { value: 1, label: 'Members Only' },
  { value: 2, label: 'Public' },
]

const ALIGNMENT_OPTIONS = [
  { value: 0, label: 'Lawful Good' },
  { value: 1, label: 'Neutral Good' },
  { value: 2, label: 'Chaotic Good' },
  { value: 3, label: 'Lawful Neutral' },
  { value: 4, label: 'True Neutral' },
  { value: 5, label: 'Chaotic Neutral' },
  { value: 6, label: 'Lawful Evil' },
  { value: 7, label: 'Neutral Evil' },
  { value: 8, label: 'Chaotic Evil' },
]

export default function EditCompanionModal({ userSlug, companion, onClose, onSaved }) {
  const isEditing = Boolean(companion?.id)
  const [form, setForm] = useState({
    name: companion?.name || '',
    platform: companion?.platform || '',
    role: companion?.role || '',
    dateOfBirth: companion?.dateOfBirth ? companion.dateOfBirth.slice(0, 10) : '',
    bio: companion?.bio || '',
    visibility: companion?.visibility ?? 0,
    alignmentEnabled: companion?.alignment != null,
    alignment: companion?.alignment ?? 4,
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [deleteImage, setDeleteImage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef()

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (name === 'visibility' || name === 'alignment' ? Number(value) : value),
    }))
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setDeleteImage(false)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleDeleteImage = () => {
    setDeleteImage(true)
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Name is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        platform: form.platform || null,
        role: form.role || null,
        dateOfBirth: form.dateOfBirth || null,
        bio: form.bio || null,
        visibility: form.visibility,
      }
      if (form.alignmentEnabled) {
        payload.alignment = form.alignment
      } else if (companion?.alignment != null) {
        payload.clearAlignment = true
      }

      let savedCompanion
      if (isEditing) {
        const res = await updateCompanion(userSlug, companion.id, payload)
        savedCompanion = res.data
      } else {
        const res = await createCompanion(userSlug, payload)
        savedCompanion = res.data
      }

      if (deleteImage && isEditing) {
        await deleteCompanionImage(userSlug, savedCompanion.id)
      } else if (imageFile) {
        await uploadCompanionImage(userSlug, savedCompanion.id, imageFile)
      }

      await onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const currentImageUrl = companion?.profileImageUrl ? getImageUrl(companion.profileImageUrl) : null

  return (
    <ModalBase title={isEditing ? 'Edit Companion' : 'Add Companion'} onClose={onClose}>
      <div className="space-y-4">
        {/* Image section — only when editing an existing companion */}
        {isEditing && (
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-200 mb-2">Companion Image</label>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 overflow-hidden flex-shrink-0">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : currentImageUrl && !deleteImage ? (
                  <img src={currentImageUrl} alt="Current" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl select-none">✨</div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                >
                  {(currentImageUrl || imagePreview) && !deleteImage ? 'Change image' : 'Upload image'}
                </button>
                {(currentImageUrl || imagePreview) && !deleteImage && (
                  <button
                    type="button"
                    onClick={handleDeleteImage}
                    className="text-sm text-red-500 hover:text-red-600"
                  >
                    Remove image
                  </button>
                )}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-200 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-200 mb-1">Platform</label>
            <input
              name="platform"
              value={form.platform}
              onChange={handleChange}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-200 mb-1">Role</label>
            <input
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-200 mb-1">Date of Birth</label>
          <input
            type="date"
            name="dateOfBirth"
            value={form.dateOfBirth}
            onChange={handleChange}
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-200 mb-1">Bio</label>
          <textarea
            name="bio"
            value={form.bio}
            onChange={handleChange}
            rows={3}
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
            placeholder="Describe this companion… (Markdown supported)"
          />
        </div>

        {/* D&D Alignment */}
        <div className="border border-stone-100 dark:border-stone-700 rounded-lg p-3 bg-stone-50 dark:bg-stone-800">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="companionAlignmentEnabled"
              name="alignmentEnabled"
              checked={form.alignmentEnabled}
              onChange={handleChange}
              className="rounded border-stone-300 text-amber-500 focus:ring-amber-300"
            />
            <label htmlFor="companionAlignmentEnabled" className="text-sm font-medium text-stone-700 dark:text-stone-200 cursor-pointer">
              D&D Alignment
            </label>
          </div>
          {form.alignmentEnabled && (
            <select
              name="alignment"
              value={form.alignment}
              onChange={handleChange}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
            >
              {ALIGNMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-200 mb-1">Visibility</label>
          <select
            name="visibility"
            value={form.visibility}
            onChange={handleChange}
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
          >
            {VISIBILITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-stone-600 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            {saving ? 'Saving…' : isEditing ? 'Save' : 'Add Companion'}
          </button>
        </div>
      </div>
    </ModalBase>
  )
}
