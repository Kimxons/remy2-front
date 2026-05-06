"use client"

import React, { useState, useMemo, useCallback, useEffect } from "react"
import "./Profile.scss"
import httpClient from "../../api/httpClient"
import Select from "react-select"
import { User, Mail, MapPin, Briefcase, Award, Calendar, Edit2, Check, X } from "lucide-react"

const Profile = () => {
  const currentUser = useMemo(() => {
    if (typeof window === 'undefined') return null;

    try {
      const userString = localStorage.getItem("currentUser")
      return userString ? JSON.parse(userString) : null
    } catch (error) {
      console.error("Failed to parse user from localStorage:", error)
      return null
    }
  }, [])

  const [alias, setAlias] = useState(currentUser?.alias || "")
  const [profileUser, setProfileUser] = useState(currentUser)
    // Step 1: Identify if the user is a freelancer
  const isFreelancer = useMemo(() => {
    return profileUser?.is_freelancer === true
  }, [profileUser])
  const RoleGuard = ({ allow, children, fallback = null }) => {
  if (allow === "FREELANCER" && !isFreelancer) return fallback
  if (allow === "CLIENT" && isFreelancer) return fallback
  if (allow === "NONE") return fallback // Force hidden
  return children
}
  const defaultProfile = "/img/Profile default.png"
  const [picture, setPicture] = useState(currentUser?.picture || defaultProfile)
  const [country, setCountry] = useState(currentUser?.country || "")
  const [status, setStatus] = useState({ message: '', type: '' })
  const [editingAlias, setEditingAlias] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [profileError, setProfileError] = useState("")
  const [activityItems, setActivityItems] = useState([])
  const [avatarFile, setAvatarFile] = useState(null)

  const avatars = [
    "Avatar1.jpg",
    "Avatar2.webp",
    "Avatar3.jpg",
    "Profile default.png",
  ]

  const countries = [
    { "name": "Afghanistan", "flag": "🇦🇫" },
    { "name": "Albania", "flag": "🇦🇱" },
    { "name": "Algeria", "flag": "🇩🇿" },
    { "name": "Andorra", "flag": "🇦🇩" },
    { "name": "Angola", "flag": "🇦🇴" },
    { "name": "Antigua and Barbuda", "flag": "🇦🇬" },
    { "name": "Argentina", "flag": "🇦🇷" },
    { "name": "Armenia", "flag": "🇦🇲" },
    { "name": "Australia", "flag": "🇦🇺" },
    { "name": "Austria", "flag": "🇦🇹" },
    { "name": "Azerbaijan", "flag": "🇦🇿" },
    { "name": "Bahamas", "flag": "🇧🇸" },
    { "name": "Bahrain", "flag": "🇧🇭" },
    { "name": "Bangladesh", "flag": "🇧🇩" },
    { "name": "Barbados", "flag": "🇧🇧" },
    { "name": "Belarus", "flag": "🇧🇾" },
    { "name": "Belgium", "flag": "🇧🇪" },
    { "name": "Belize", "flag": "🇧🇿" },
    { "name": "Benin", "flag": "🇧🇯" },
    { "name": "Bhutan", "flag": "🇧🇹" },
    { "name": "Bolivia", "flag": "🇧🇴" },
    { "name": "Bosnia and Herzegovina", "flag": "🇧🇦" },
    { "name": "Botswana", "flag": "🇧🇼" },
    { "name": "Brazil", "flag": "🇧🇷" },
    { "name": "Brunei", "flag": "🇧🇳" },
    { "name": "Bulgaria", "flag": "🇧🇬" },
    { "name": "Burkina Faso", "flag": "🇧🇫" },
    { "name": "Burundi", "flag": "🇧🇮" },
    { "name": "Cabo Verde", "flag": "🇨🇻" },
    { "name": "Cambodia", "flag": "🇰🇭" },
    { "name": "Cameroon", "flag": "🇨🇲" },
    { "name": "Canada", "flag": "🇨🇦" },
    { "name": "Central African Republic", "flag": "🇨🇫" },
    { "name": "Chad", "flag": "🇹🇩" },
    { "name": "Chile", "flag": "🇨🇱" },
    { "name": "China", "flag": "🇨🇳" },
    { "name": "Colombia", "flag": "🇨🇴" },
    { "name": "Comoros", "flag": "🇰🇲" },
    { "name": "Congo, Democratic Republic of the", "flag": "🇨🇩" },
    { "name": "Congo, Republic of the", "flag": "🇨🇬" },
    { "name": "Costa Rica", "flag": "🇨🇷" },
    { "name": "Côte d'Ivoire", "flag": "🇨🇮" },
    { "name": "Croatia", "flag": "🇭🇷" },
    { "name": "Cuba", "flag": "🇨🇺" },
    { "name": "Cyprus", "flag": "🇨🇾" },
    { "name": "Czechia", "flag": "🇨🇿" },
    { "name": "Denmark", "flag": "🇩🇰" },
    { "name": "Djibouti", "flag": "🇩🇯" },
    { "name": "Dominica", "flag": "🇩🇲" },
    { "name": "Dominican Republic", "flag": "🇩🇴" },
    { "name": "Ecuador", "flag": "🇪🇨" },
    { "name": "Egypt", "flag": "🇪🇬" },
    { "name": "El Salvador", "flag": "🇸🇻" },
    { "name": "Equatorial Guinea", "flag": "🇬🇶" },
    { "name": "Eritrea", "flag": "🇪🇷" },
    { "name": "Estonia", "flag": "🇪🇪" },
    { "name": "Eswatini", "flag": "🇸🇿" },
    { "name": "Ethiopia", "flag": "🇪🇹" },
    { "name": "Fiji", "flag": "🇫🇯" },
    { "name": "Finland", "flag": "🇫🇮" },
    { "name": "France", "flag": "🇫🇷" },
    { "name": "Gabon", "flag": "🇬🇦" },
    { "name": "Gambia", "flag": "🇬🇲" },
    { "name": "Georgia", "flag": "🇬🇪" },
    { "name": "Germany", "flag": "🇩🇪" },
    { "name": "Ghana", "flag": "🇬🇭" },
    { "name": "Greece", "flag": "🇬🇷" },
    { "name": "Grenada", "flag": "🇬🇩" },
    { "name": "Guatemala", "flag": "🇬🇹" },
    { "name": "Guinea", "flag": "🇬🇳" },
    { "name": "Guinea-Bissau", "flag": "🇬🇼" },
    { "name": "Guyana", "flag": "🇬🇾" },
    { "name": "Haiti", "flag": "🇭🇹" },
    { "name": "Holy See", "flag": "🇻🇦" },
    { "name": "Honduras", "flag": "🇭🇳" },
    { "name": "Hungary", "flag": "🇭🇺" },
    { "name": "Iceland", "flag": "🇮🇸" },
    { "name": "India", "flag": "🇮🇳" },
    { "name": "Indonesia", "flag": "🇮🇩" },
    { "name": "Iran", "flag": "🇮🇷" },
    { "name": "Iraq", "flag": "🇮🇶" },
    { "name": "Ireland", "flag": "🇮🇪" },
    { "name": "Israel", "flag": "🇮🇱" },
    { "name": "Italy", "flag": "🇮🇹" },
    { "name": "Jamaica", "flag": "🇯🇲" },
    { "name": "Japan", "flag": "🇯🇵" },
    { "name": "Jordan", "flag": "🇯🇴" },
    { "name": "Kazakhstan", "flag": "🇰🇿" },
    { "name": "Kenya", "flag": "🇰🇪" },
    { "name": "Kiribati", "flag": "🇰🇮" },
    { "name": "Kuwait", "flag": "🇰🇼" },
    { "name": "Kyrgyzstan", "flag": "🇰🇬" },
    { "name": "Laos", "flag": "🇱🇦" },
    { "name": "Latvia", "flag": "🇱🇻" },
    { "name": "Lebanon", "flag": "🇱🇧" },
    { "name": "Lesotho", "flag": "🇱🇸" },
    { "name": "Liberia", "flag": "🇱🇷" },
    { "name": "Libya", "flag": "🇱🇾" },
    { "name": "Liechtenstein", "flag": "🇱🇮" },
    { "name": "Lithuania", "flag": "🇱🇹" },
    { "name": "Luxembourg", "flag": "🇱🇺" },
    { "name": "Madagascar", "flag": "🇲🇬" },
    { "name": "Malawi", "flag": "🇲🇼" },
    { "name": "Malaysia", "flag": "🇲🇾" },
    { "name": "Maldives", "flag": "🇲🇻" },
    { "name": "Mali", "flag": "🇲🇱" },
    { "name": "Malta", "flag": "🇲🇹" },
    { "name": "Marshall Islands", "flag": "🇲🇭" },
    { "name": "Mauritania", "flag": "🇲🇷" },
    { "name": "Mauritius", "flag": "🇲🇺" },
    { "name": "Mexico", "flag": "🇲🇽" },
    { "name": "Micronesia", "flag": "🇫🇲" },
    { "name": "Moldova", "flag": "🇲🇩" },
    { "name": "Monaco", "flag": "🇲🇨" },
    { "name": "Mongolia", "flag": "🇲🇳" },
    { "name": "Montenegro", "flag": "🇲🇪" },
    { "name": "Morocco", "flag": "🇲🇦" },
    { "name": "Mozambique", "flag": "🇲🇿" },
    { "name": "Myanmar", "flag": "🇲🇲" },
    { "name": "Namibia", "flag": "🇳🇦" },
    { "name": "Nauru", "flag": "🇳🇷" },
    { "name": "Nepal", "flag": "🇳🇵" },
    { "name": "Netherlands", "flag": "🇳🇱" },
    { "name": "New Zealand", "flag": "🇳🇿" },
    { "name": "Nicaragua", "flag": "🇳🇮" },
    { "name": "Niger", "flag": "🇳🇪" },
    { "name": "Nigeria", "flag": "🇳🇬" },
    { "name": "North Korea", "flag": "🇰🇵" },
    { "name": "North Macedonia", "flag": "🇲🇰" },
    { "name": "Norway", "flag": "🇳🇴" },
    { "name": "Oman", "flag": "🇴🇲" },
    { "name": "Pakistan", "flag": "🇵🇰" },
    { "name": "Palau", "flag": "🇵🇼" },
    { "name": "Palestine, State of", "flag": "🇵🇸" },
    { "name": "Panama", "flag": "🇵🇦" },
    { "name": "Papua New Guinea", "flag": "🇵🇬" },
    { "name": "Paraguay", "flag": "🇵🇾" },
    { "name": "Peru", "flag": "🇵🇪" },
    { "name": "Philippines", "flag": "🇵🇭" },
    { "name": "Poland", "flag": "🇵🇱" },
    { "name": "Portugal", "flag": "🇵🇹" },
    { "name": "Qatar", "flag": "🇶🇦" },
    { "name": "Romania", "flag": "🇷🇴" },
    { "name": "Russia", "flag": "🇷🇺" },
    { "name": "Rwanda", "flag": "🇷🇼" },
    { "name": "Saint Kitts and Nevis", "flag": "🇰🇳" },
    { "name": "Saint Lucia", "flag": "🇱🇨" },
    { "name": "Saint Vincent and the Grenadines", "flag": "🇻🇨" },
    { "name": "Samoa", "flag": "🇼🇸" },
    { "name": "San Marino", "flag": "🇸🇲" },
    { "name": "Sao Tome and Principe", "flag": "🇸🇹" },
    { "name": "Saudi Arabia", "flag": "🇸🇦" },
    { "name": "Senegal", "flag": "🇸🇳" },
    { "name": "Serbia", "flag": "🇷🇸" },
    { "name": "Seychelles", "flag": "🇸🇨" },
    { "name": "Sierra Leone", "flag": "🇸🇱" },
    { "name": "Singapore", "flag": "🇸🇬" },
    { "name": "Slovakia", "flag": "🇸🇰" },
    { "name": "Slovenia", "flag": "🇸🇮" },
    { "name": "Solomon Islands", "flag": "🇸🇧" },
    { "name": "Somalia", "flag": "🇸🇴" },
    { "name": "South Africa", "flag": "🇿🇦" },
    { "name": "South Korea", "flag": "🇰🇷" },
    { "name": "South Sudan", "flag": "🇸🇸" },
    { "name": "Spain", "flag": "🇪🇸" },
    { "name": "Sri Lanka", "flag": "🇱🇰" },
    { "name": "Sudan", "flag": "🇸🇩" },
    { "name": "Suriname", "flag": "🇸🇷" },
    { "name": "Sweden", "flag": "🇸🇪" },
    { "name": "Switzerland", "flag": "🇨🇭" },
    { "name": "Syria", "flag": "🇸🇾" },
    { "name": "Taiwan", "flag": "🇹🇼" },
    { "name": "Tajikistan", "flag": "🇹🇯" },
    { "name": "Tanzania", "flag": "🇹🇿" },
    { "name": "Thailand", "flag": "🇹🇭" },
    { "name": "Timor-Leste", "flag": "🇹🇱" },
    { "name": "Togo", "flag": "🇹🇬" },
    { "name": "Tonga", "flag": "🇹🇴" },
    { "name": "Trinidad and Tobago", "flag": "🇹🇹" },
    { "name": "Tunisia", "flag": "🇹🇳" },
    { "name": "Turkey", "flag": "🇹🇷" },
    { "name": "Turkmenistan", "flag": "🇹🇲" },
    { "name": "Tuvalu", "flag": "🇹🇻" },
    { "name": "Uganda", "flag": "🇺🇬" },
    { "name": "Ukraine", "flag": "🇺🇦" },
    { "name": "United Arab Emirates", "flag": "🇦🇪" },
    { "name": "United Kingdom", "flag": "🇬🇧" },
    { "name": "United States of America", "flag": "🇺🇸" },
    { "name": "Uruguay", "flag": "🇺🇾" },
    { "name": "Uzbekistan", "flag": "🇺🇿" },
    { "name": "Vanuatu", "flag": "🇻🇺" },
    { "name": "Venezuela", "flag": "🇻🇪" },
    { "name": "Vietnam", "flag": "🇻🇳" },
    { "name": "Yemen", "flag": "🇾🇪" },
    { "name": "Zambia", "flag": "🇿🇲" },
    { "name": "Zimbabwe", "flag": "🇿🇼" }
  ]

  const countryOptions = useMemo(() => countries.map((c) => ({
    value: c.name,
    label: (
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: "1.2rem" }}>{c.flag}</span>
        <span>{c.name}</span>
      </div>
    ),
  })), [])

  const displayStatus = (message, type) => {
    setStatus({ message, type })
    setTimeout(() => setStatus({ message: '', type: '' }), 3000)
  }

  const profilePictureEndpoints = useMemo(
    () => ["/users/profile/picture/", "/profile/picture/", "/profile/picture"],
    []
  )

  const requestProfilePictureEndpoint = useCallback(
    async ({ method = "get", data, headers } = {}) => {
      let lastError = null

      for (const endpoint of profilePictureEndpoints) {
        try {
          const response = await httpClient.request({
            method,
            url: endpoint,
            data,
            headers,
          })
          return response
        } catch (error) {
          const status = error?.response?.status
          lastError = error
          if (status === 404 || status === 405) {
            continue
          }
          throw error
        }
      }

      if (lastError) throw lastError
      throw new Error("Profile picture endpoint is unavailable.")
    },
    [profilePictureEndpoints]
  )

  const fetchProfileData = useCallback(async () => {
    try {
      setLoadingProfile(true)
      setProfileError("")

      const [meResponse, summaryResponse, pictureResponse] = await Promise.allSettled([
        httpClient.get("/users/me/"),
        httpClient.get("/users/dashboard/summary/"),
        requestProfilePictureEndpoint({ method: "get" }),
      ])

      if (meResponse.status === "fulfilled" && meResponse.value?.data && typeof meResponse.value.data === "object") {
        const userData = meResponse.value.data
        setProfileUser(userData)
        setAlias(userData.alias || "")
        setPicture(userData.picture || userData.avatar || defaultProfile)
        setCountry(userData.country || userData.location || "")
      } else {
        setProfileError("Failed to load profile data.")
      }

      if (
        pictureResponse.status === "fulfilled" &&
        pictureResponse.value?.data &&
        typeof pictureResponse.value.data === "object"
      ) {
        const pictureData = pictureResponse.value.data
        setPicture(
          pictureData.picture ||
            pictureData.avatar ||
            (meResponse.status === "fulfilled"
              ? meResponse.value?.data?.picture || meResponse.value?.data?.avatar
              : "") ||
            defaultProfile
        )
        setCountry(
          pictureData.country ||
            pictureData.location ||
            (meResponse.status === "fulfilled"
              ? meResponse.value?.data?.country || meResponse.value?.data?.location
              : "") ||
            ""
        )
      }

      if (
        summaryResponse.status === "fulfilled" &&
        summaryResponse.value?.data &&
        typeof summaryResponse.value.data === "object"
      ) {
        const data = summaryResponse.value.data
        const notifications = Array.isArray(data.notifications)
          ? data.notifications
          : Array.isArray(data.recent_notifications)
            ? data.recent_notifications
            : []
        setActivityItems(notifications)
      } else {
        setActivityItems([])
      }
    } catch (error) {
      setProfileError("Failed to load profile data.")
      setActivityItems([])
    } finally {
      setLoadingProfile(false)
    }
  }, [defaultProfile, requestProfilePictureEndpoint])

  const saveAlias = useCallback(async () => {
    try {
      await httpClient.post("/profile/alias", { alias })
      displayStatus("Alias saved successfully!", 'success')
      setEditingAlias(false)
      await fetchProfileData()
    } catch (err) {
      displayStatus("Failed to save alias.", 'error')
    }
  }, [alias, fetchProfileData])

  const savePictureAndCountry = useCallback(async () => {
    try {
      let payload = null
      let headers = undefined

      if (avatarFile instanceof File) {
        const formData = new FormData()
        formData.append("picture", avatarFile)
        formData.append("avatar", avatarFile)
        formData.append("profile_picture", avatarFile)
        formData.append("country", country || "")
        formData.append("location", country || "")
        payload = formData
        headers = { "Content-Type": "multipart/form-data" }
      } else {
        payload = {
          picture: picture || "",
          avatar: picture || "",
          profile_picture: picture || "",
          country: country || "",
          location: country || "",
        }
      }

      let saved = false
      let lastError = null
      for (const method of ["patch", "post", "put"]) {
        try {
          await requestProfilePictureEndpoint({ method, data: payload, headers })
          saved = true
          break
        } catch (error) {
          lastError = error
        }
      }
      if (!saved) throw lastError || new Error("Failed to update profile picture.")

      setAvatarFile(null)
      displayStatus("Profile updated successfully!", 'success')
      await fetchProfileData()
    } catch (err) {
      displayStatus("Failed to update profile.", 'error')
    }
  }, [avatarFile, picture, country, fetchProfileData, requestProfilePictureEndpoint])

  const selectedCountryOption = useMemo(() => countryOptions.find((opt) => opt.value === country), [country, countryOptions])

  useEffect(() => {
    fetchProfileData()
  }, [fetchProfileData])

  const quickStats = useMemo(() => {
    const sourceUser = profileUser || {}
    const profile = sourceUser?.profile || {}
    const parseNumber = (...values) => {
      for (const value of values) {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
      }
      return null
    }

    const activeProjects = parseNumber(
      profile.active_projects,
      profile.active_jobs,
      sourceUser?.active_projects,
      sourceUser?.active_jobs
    )

    const completedJobs = parseNumber(
      profile.completed_jobs,
      profile.jobs_completed,
      sourceUser?.completed_jobs,
      sourceUser?.jobs_completed
    )

    const rating = parseNumber(
      profile.average_rating,
      profile.avg_rating,
      profile.rating,
      sourceUser?.average_rating,
      sourceUser?.avg_rating,
      sourceUser?.rating
    )

    return {
      activeProjects,
      completedJobs,
      rating,
    }
  }, [profileUser])

  const memberSince = useMemo(() => {
    const createdAt = profileUser?.date_joined || profileUser?.created_at || profileUser?.createdAt
    if (!createdAt) return "—"
    const parsed = new Date(createdAt)
    if (Number.isNaN(parsed.getTime())) return "—"
    return parsed.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    })
  }, [profileUser])

  if (loadingProfile) {
    return (
      <div className="profile-page">
        <div className="profile-hero">
          <div className="hero-content">
            <div className="profile-details">
              <div className="username-section">
                <h1>Loading profile...</h1>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="profile-page">
      {/* Hero Header */}
      <div className="profile-hero">
        <div className="hero-background"></div>
        <div className="hero-content">
           <RoleGuard allow="NONE">
            <div className="profile-avatar">
              <img src={picture || defaultProfile} alt="profile" />
              <div className="avatar-badge">
                <User size={20} />
              </div>
            </div>
          </RoleGuard>
          <div className="profile-details">
            <div className="username-section">
              <h1>@{profileUser?.username || "unknown"}</h1>
              {alias && <span className="alias-tag">{alias}</span>}
            </div>
            <div className="user-meta">
              <div className="meta-item">
                <User size={16} />
                <span>{profileUser?.fName || profileUser?.first_name || ""} {profileUser?.lName || profileUser?.last_name || ""}</span>
              </div>
              {profileUser?.email && (
                <div className="meta-item">
                  <Mail size={16} />
                  <span>{profileUser.email}</span>
                </div>
              )}
              {country && (
                <div className="meta-item">
                  <MapPin size={16} />
                  <span>{country}</span>
                </div>
              )}
              <div className="meta-item">
                <Calendar size={16} />
                <span>Member since {memberSince}</span>
              </div>
              {profileUser?.role && (
                <div className="meta-item">
                  <Briefcase size={16} />
                  <span>{String(profileUser.role).replaceAll("_", " ")}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {profileError && (
        <div className="status-toast error">
          <div className="toast-icon">
            <X size={20} />
          </div>
          <span>{profileError}</span>
        </div>
      )}

      {/* Status Message */}
      {status.message && (
        <div className={`status-toast ${status.type}`}>
          <div className="toast-icon">
            {status.type === 'success' ? <Check size={20} /> : <X size={20} />}
          </div>
          <span>{status.message}</span>
        </div>
      )}
      <div className="profile-content">
        {/* Profile Settings Card */}
        <RoleGuard allow="NONE">
        <div className="settings-card">
          <div className="card-header">
            <h2>Profile Settings</h2>
            <p>Customize your profile information</p>
          </div>

          {/* Alias Section */}
          <div className="settings-section">
            <div className="section-title">
              <Edit2 size={18} />
              <h3>Display Alias</h3>
            </div>
            <div className="alias-editor">
              {editingAlias ? (
                <div className="edit-mode">
                  <input
                    type="text"
                    placeholder="Enter your alias"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    autoFocus
                  />
                  <div className="edit-actions">
                    <button className="btn-save" onClick={saveAlias}>
                      <Check size={18} />
                      Save
                    </button>
                    <button
                      className="btn-cancel"
                      onClick={() => {
                        setEditingAlias(false)
                        setAlias(profileUser?.alias || "")
                      }}
                    >
                      <X size={18} />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="view-mode">
                  <span className="alias-display">{alias || "No alias set"}</span>
                  <button className="btn-edit" onClick={() => setEditingAlias(true)}>
                    <Edit2 size={16} />
                    Edit
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Avatar Selection */}
          <div className="settings-section">
            <div className="section-title">
              <User size={18} />
              <h3>Profile Picture</h3>
            </div>
            <div className="avatar-gallery">
              {avatars.map((img, i) => (
                <div
                  key={i}
                  className={`avatar-option ${picture === `/img/${img}` ? 'selected' : ''}`}
                  onClick={() => {
                    setAvatarFile(null)
                    setPicture(`/img/${img}`)
                  }}
                >
                  <img src={`/img/${img}`} alt={`avatar-${i}`} />
                  {picture === `/img/${img}` && (
                    <div className="selected-badge">
                      <Check size={16} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="avatar-upload">
              <label htmlFor="profile-avatar-upload">Upload custom image</label>
              <input
                id="profile-avatar-upload"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  setAvatarFile(file)
                  setPicture(URL.createObjectURL(file))
                }}
              />
            </div>
          </div>

          {/* Country Selection */}
          <div className="settings-section">
            <div className="section-title">
              <MapPin size={18} />
              <h3>Country</h3>
            </div>
            <div className="country-selector">
              <Select
                options={countryOptions}
                value={selectedCountryOption}
                onChange={(opt) => setCountry(opt ? opt.value : "")}
                isClearable
                classNamePrefix="country-select"
                placeholder="Select your country..."
              />
            </div>
          </div>

          <button className="btn-primary" onClick={savePictureAndCountry}>
            Save Changes
          </button>
        </div>

        {/* Quick Stats Card */}
        <div className="stats-card">
          <div className="card-header">
            <h2>Quick Stats</h2>
          </div>
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-icon briefcase">
                <Briefcase size={24} />
              </div>
              <div className="stat-details">
                <span className="stat-value">{quickStats.activeProjects ?? "—"}</span>
                <span className="stat-label">Active Projects</span>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-icon award">
                <Award size={24} />
              </div>
              <div className="stat-details">
                <span className="stat-value">{quickStats.completedJobs ?? "—"}</span>
                <span className="stat-label">Completed Jobs</span>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-icon user">
                <User size={24} />
              </div>
              <div className="stat-details">
                <span className="stat-value">{quickStats.rating != null ? quickStats.rating.toFixed(1) : "N/A"}</span>
                <span className="stat-label">Rating</span>
              </div>
            </div>
          </div>
        </div>
      </RoleGuard>

        <div className="account-card">
          <div className="card-header">
            <h2>Account Overview</h2>
            <p>Live account information from your profile</p>
          </div>
          <div className="account-grid">
            <div className="account-row">
              <span className="label">Username</span>
              <span className="value">{profileUser?.username || "—"}</span>
            </div>
            <div className="account-row">
              <span className="label">Email</span>
              <span className="value">{profileUser?.email || "—"}</span>
            </div>
            <div className="account-row">
              <span className="label">Phone</span>
              <span className="value">{profileUser?.phone || "—"}</span>
            </div>
            <div className="account-row">
              <span className="label">Role</span>
              <span className="value">{profileUser?.role || "—"}</span>
            </div>
            <div className="account-row">
              <span className="label">Status</span>
              <span className="value">{profileUser?.is_active === false ? "Inactive" : "Active"}</span>
            </div>
            <div className="account-row">
              <span className="label">Member Since</span>
              <span className="value">{memberSince}</span>
            </div>
          </div>
        </div>

        {/* Activity Card */}
        <div className="activity-card">
          <div className="card-header">
            <h2>Recent Activity</h2>
          </div>
          <div className="activity-list">
            {activityItems.length > 0 ? activityItems.slice(0, 6).map((item) => (
              <div className="activity-item" key={item.id}>
                <div className="activity-icon">
                  <Briefcase size={16} />
                </div>
                <div className="activity-content">
                  <p className="activity-title">{item.text || "Activity update"}</p>
                  <span className="activity-time">
                    {item.created_at
                      ? new Date(item.created_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </span>
                </div>
              </div>
            )) : (
              <div className="activity-item">
                <div className="activity-icon">
                  <Briefcase size={16} />
                </div>
                <div className="activity-content">
                  <p className="activity-title">No recent activity yet</p>
                  <span className="activity-time">Your updates will appear here once available.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile
