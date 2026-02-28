import { useState, useRef, useEffect } from 'react'
import ModalBase from './ModalBase'
import { updateUser, uploadUserImage, deleteUserImage, uploadUserBanner, deleteUserBanner, getImageUrl } from '../lib/api'

// All real-world UTC offsets as { value (minutes), label }
const TIMEZONE_OFFSETS = [
  { value: -720, label: 'UTC-12' },
  { value: -660, label: 'UTC-11' },
  { value: -600, label: 'UTC-10' },
  { value: -570, label: 'UTC-9:30' },
  { value: -540, label: 'UTC-9' },
  { value: -480, label: 'UTC-8' },
  { value: -420, label: 'UTC-7' },
  { value: -360, label: 'UTC-6' },
  { value: -300, label: 'UTC-5' },
  { value: -240, label: 'UTC-4' },
  { value: -210, label: 'UTC-3:30' },
  { value: -180, label: 'UTC-3' },
  { value: -120, label: 'UTC-2' },
  { value: -60,  label: 'UTC-1' },
  { value: 0,    label: 'UTC+0' },
  { value: 60,   label: 'UTC+1' },
  { value: 120,  label: 'UTC+2' },
  { value: 180,  label: 'UTC+3' },
  { value: 210,  label: 'UTC+3:30' },
  { value: 240,  label: 'UTC+4' },
  { value: 270,  label: 'UTC+4:30' },
  { value: 300,  label: 'UTC+5' },
  { value: 330,  label: 'UTC+5:30' },
  { value: 345,  label: 'UTC+5:45' },
  { value: 360,  label: 'UTC+6' },
  { value: 390,  label: 'UTC+6:30' },
  { value: 420,  label: 'UTC+7' },
  { value: 480,  label: 'UTC+8' },
  { value: 525,  label: 'UTC+8:45' },
  { value: 540,  label: 'UTC+9' },
  { value: 570,  label: 'UTC+9:30' },
  { value: 600,  label: 'UTC+10' },
  { value: 630,  label: 'UTC+10:30' },
  { value: 660,  label: 'UTC+11' },
  { value: 720,  label: 'UTC+12' },
  { value: 765,  label: 'UTC+12:45' },
  { value: 780,  label: 'UTC+13' },
  { value: 840,  label: 'UTC+14' },
]

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

function VisibilityInlineSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="text-xs border border-stone-200 dark:border-stone-600 rounded-md px-1.5 py-0.5 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 focus:outline-none focus:ring-1 focus:ring-amber-300"
    >
      {VISIBILITY_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}

export default function EditProfileModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    alternativeName: user.alternativeName || '',
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : '',
    country: user.country || '',
    city: user.city || '',
    bio: user.bio || '',
    visibility: user.visibility ?? 2,
    locationVisibility: user.locationVisibility ?? 1,
    dateOfBirthVisibility: user.dateOfBirthVisibility ?? 1,
    alignmentEnabled: user.alignment != null,
    alignment: user.alignment ?? 4,
    timezone: user.timezoneOffsetMinutes ?? '',
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [deleteImage, setDeleteImage] = useState(false)
  const [bannerFile, setBannerFile] = useState(null)
  const [bannerPreview, setBannerPreview] = useState(null)
  const [deleteBanner, setDeleteBanner] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef()
  const bannerInputRef = useRef()
  const bioRef = useRef()

  // Auto-resize bio textarea as content changes
  useEffect(() => {
    const el = bioRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 384) + 'px'
  }, [form.bio])

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

  const handleBannerFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setBannerFile(file)
    setDeleteBanner(false)
    setBannerPreview(URL.createObjectURL(file))
  }

  const handleDeleteBanner = () => {
    setDeleteBanner(true)
    setBannerFile(null)
    setBannerPreview(null)
    if (bannerInputRef.current) bannerInputRef.current.value = ''
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        alternativeName: form.alternativeName || null,
        dateOfBirth: form.dateOfBirth || null,
        country: form.country || null,
        city: form.city || null,
        bio: form.bio || null,
        visibility: form.visibility,
        locationVisibility: form.locationVisibility,
        dateOfBirthVisibility: form.dateOfBirthVisibility,
      }
      if (form.alignmentEnabled) {
        payload.alignment = form.alignment
      } else if (user.alignment != null) {
        payload.clearAlignment = true
      }
      if (form.timezone === '') {
        if (user.timezoneOffsetMinutes != null) payload.clearTimezone = true
      } else {
        payload.timezoneOffsetMinutes = Number(form.timezone)
      }
      await updateUser(user.slug, payload)
      if (deleteImage) {
        await deleteUserImage(user.slug)
      } else if (imageFile) {
        await uploadUserImage(user.slug, imageFile)
      }
      if (deleteBanner) {
        await deleteUserBanner(user.slug)
      } else if (bannerFile) {
        await uploadUserBanner(user.slug, bannerFile)
      }
      await onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const currentImageUrl = user.profileImageUrl ? getImageUrl(user.profileImageUrl) : null
  const showCurrentImage = currentImageUrl && !deleteImage && !imagePreview

  return (
    <ModalBase title="Edit Profile" onClose={onClose} size="lg">
      <div className="space-y-4">
        {/* Banner section */}
        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-200 mb-2">Banner Image</label>
          <div className="relative w-full h-24 rounded-xl overflow-hidden bg-gradient-to-r from-amber-100 via-orange-50 to-stone-100 dark:from-amber-900/30 dark:via-orange-900/20 dark:to-stone-800 mb-2">
            {bannerPreview ? (
              <img src={bannerPreview} alt="Banner preview" className="w-full h-full object-cover" />
            ) : user.bannerImageUrl && !deleteBanner ? (
              <img src={getImageUrl(user.bannerImageUrl)} alt="Current banner" className="w-full h-full object-cover" />
            ) : null}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              className="text-sm text-amber-600 hover:text-amber-700 font-medium"
            >
              {user.bannerImageUrl || bannerPreview ? 'Change banner' : 'Upload banner'}
            </button>
            {(user.bannerImageUrl || bannerPreview) && !deleteBanner && (
              <button
                type="button"
                onClick={handleDeleteBanner}
                className="text-sm text-red-500 hover:text-red-600"
              >
                Remove banner
              </button>
            )}
          </div>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleBannerFileChange}
          />
        </div>

        {/* Image section */}
        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-200 mb-2">Profile Image</label>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-200 to-orange-200 overflow-hidden flex-shrink-0">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              ) : showCurrentImage ? (
                <img src={currentImageUrl} alt="Current" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl select-none">👤</div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-sm text-amber-600 hover:text-amber-700 font-medium"
              >
                {currentImageUrl || imagePreview ? 'Change image' : 'Upload image'}
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

        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-200 mb-1">Display Name</label>
          <input
            name="alternativeName"
            value={form.alternativeName}
            onChange={handleChange}
            placeholder={user.discordUsername}
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>

        {/* Location with visibility */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-200">Location</label>
            <div className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500">
              <span>Visible to:</span>
              <VisibilityInlineSelect
                value={form.locationVisibility}
                onChange={(v) => setForm((prev) => ({ ...prev, locationVisibility: v }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              name="city"
              value={form.city}
              onChange={handleChange}
              placeholder="City"
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <input
              name="country"
              value={form.country}
              onChange={handleChange}
              placeholder="Country"
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-200 mb-1">Timezone</label>
          <select
            name="timezone"
            value={form.timezone}
            onChange={handleChange}
            className="w-full border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100"
          >
            <option value="">— not set —</option>
            {TIMEZONE_OFFSETS.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>

        {/* Date of birth with visibility */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-200">Date of Birth</label>
            <div className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500">
              <span>Visible to:</span>
              <VisibilityInlineSelect
                value={form.dateOfBirthVisibility}
                onChange={(v) => setForm((prev) => ({ ...prev, dateOfBirthVisibility: v }))}
              />
            </div>
          </div>
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
            ref={bioRef}
            name="bio"
            value={form.bio}
            onChange={handleChange}
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none overflow-y-auto"
            style={{ minHeight: '8rem', maxHeight: '24rem' }}
            placeholder="Tell us about yourself... (Markdown supported)"
          />
        </div>

        {/* D&D Alignment */}
        <div className="border border-stone-100 dark:border-stone-700 rounded-lg p-3 bg-stone-50 dark:bg-stone-800">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="alignmentEnabled"
              name="alignmentEnabled"
              checked={form.alignmentEnabled}
              onChange={handleChange}
              className="rounded border-stone-300 text-amber-500 focus:ring-amber-300"
            />
            <label htmlFor="alignmentEnabled" className="text-sm font-medium text-stone-700 dark:text-stone-200 cursor-pointer">
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
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-200 mb-1">Profile Visibility</label>
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
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </ModalBase>
  )
}
