"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import {MapPin, Phone, Star, Navigation, Search, X, AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Building2, Stethoscope,
  HeartPulse, Droplets, Activity, Filter, LocateFixed, SlidersHorizontal} from "lucide-react"
import type { HealthcareFacilityRow } from "@/lib/queries"
import { PageLayout } from "@/components/page-layout"

// ─── Types ───────────────────────────────────────────────────────────────────

type LangCode = "en" | "ms" | "zh"

interface Props {
  facilities: HealthcareFacilityRow[]
}

// Content for healthcare page, organized by language for easy access in the component
const content = {
  en: {
    title: "Find a Clinic Near You",
    subtitle: "Locate clinics and hospitals offering Three Highs (diabetes, blood pressure & cholesterol) health screenings.",
    consent_title: "Enable Location?",
    consent_desc: "We can sort clinics by distance if you share your location. Your location is never stored.",
    consent_allow: "Yes, Use My Location",
    consent_deny: "No Thanks, Search Manually",
    search_placeholder: "Search clinic or area…",
    filter_state: "All States",
    filter_sector: "All Sectors",
    filter_specialty: "All Specialties",
    label_state: "State",
    label_sector: "Sector",
    label_specialty: "Specialty",
    filters_label: "Filters:",
    sector_public: "Public",
    sector_private: "Private",
    specialty_diabetes: "Diabetes",
    specialty_bp: "Blood Pressure",
    specialty_cholesterol: "Cholesterol",
    clear_filters: "Clear All Filters",
    distance: "km away",
    rating: "Rating",
    navigate: "Get Directions",
    call: "Call Clinic",
    no_results: "No clinics match your search. Try adjusting your filters.",
    disclaimer: "Important Notice",
    disclaimer_text: "This directory is for reference only. Please verify details and contact the clinic directly before visiting.",
    loading: "Locating nearby clinics…",
    location_detected: "Using your location",
    sorted_by_distance: "Clinics sorted by distance",
    location_not_available: "Showing all clinics — enable location for distance sorting",
    results_count: "clinics found",
    pagination_previous: "Previous",
    pagination_next: "Next",
    pagination_showing: "Showing",
    pagination_of: "of",
    pagination_results: "clinics",
    public_sector: "Public",
    private_sector: "Private",
    tags_label: "Screening Available:",
  },
  ms: {
    title: "Cari Klinik Berdekatan",
    subtitle: "Cari klinik dan hospital yang menawarkan saringan Tiga Tinggi (diabetes, tekanan darah & kolesterol).",
    consent_title: "Aktifkan Lokasi?",
    consent_desc: "Kami boleh menyusun klinik mengikut jarak jika anda berkongsi lokasi anda. Lokasi anda tidak disimpan.",
    consent_allow: "Ya, Guna Lokasi Saya",
    consent_deny: "Tidak, Cari Manual",
    search_placeholder: "Cari klinik atau kawasan",
    filter_state: "Semua Negeri",
    filter_sector: "Semua Sektor",
    filter_specialty: "Semua Kepakaran",
    label_state: "Negeri",
    label_sector: "Sektor",
    label_specialty: "Kepakaran",
    filters_label: "Tapis:",
    sector_public: "Awam",
    sector_private: "Swasta",
    specialty_diabetes: "Diabetes",
    specialty_bp: "Tekanan Darah",
    specialty_cholesterol: "Kolesterol",
    clear_filters: "Kosongkan Penapis",
    distance: "km jauh",
    rating: "Penilaian",
    navigate: "Dapatkan Arah",
    call: "Hubungi Klinik",
    no_results: "Tiada klinik sepadan. Cuba laraskan penapis anda.",
    disclaimer: "Notis Penting",
    disclaimer_text: "Direktori ini adalah untuk rujukan sahaja. Sila sahkan butiran dan hubungi klinik secara langsung sebelum melawat.",
    loading: "Mencari klinik berdekatan…",
    location_detected: "Menggunakan lokasi anda",
    sorted_by_distance: "Klinik disusun mengikut jarak",
    location_not_available: "Menunjukkan semua klinik — aktifkan lokasi untuk susunan jarak",
    results_count: "klinik dijumpai",
    pagination_previous: "Sebelum",
    pagination_next: "Seterusnya",
    pagination_showing: "Menunjukkan",
    pagination_of: "daripada",
    pagination_results: "klinik",
    public_sector: "Awam",
    private_sector: "Swasta",
    tags_label: "Saringan Tersedia:",
  },
  zh: {
    title: "查找附近诊所",
    subtitle: "查找提供三高（糖尿病、血压和胆固醇）健康筛查的诊所和医院。",
    consent_title: "启用位置？",
    consent_desc: "如果您分享位置，我们可以按距离排序诊所。您的位置不会被存储。",
    consent_allow: "是，使用我的位置",
    consent_deny: "不，手动搜索",
    search_placeholder: "搜索诊所名称或地区…",
    filter_state: "所有州属",
    filter_sector: "所有类型",
    filter_specialty: "所有专科",
    label_state: "州属",
    label_sector: "类型",
    label_specialty: "专科",
    filters_label: "筛选：",
    sector_public: "公立",
    sector_private: "私立",
    specialty_diabetes: "糖尿病",
    specialty_bp: "血压",
    specialty_cholesterol: "胆固醇",
    clear_filters: "清除筛选",
    distance: "公里外",
    rating: "评分",
    navigate: "获取路线",
    call: "致电诊所",
    no_results: "没有符合条件的诊所。请调整筛选条件。",
    disclaimer: "重要通知",
    disclaimer_text: "此目录仅供参考。请在访问前核实详情并直接联系诊所。",
    loading: "正在查找附近诊所…",
    location_detected: "使用您的位置",
    sorted_by_distance: "诊所按距离排序",
    location_not_available: "显示所有诊所 — 启用位置以按距离排序",
    results_count: "家诊所",
    pagination_previous: "上一页",
    pagination_next: "下一页",
    pagination_showing: "显示",
    pagination_of: "/",
    pagination_results: "家诊所",
    public_sector: "公立",
    private_sector: "私立",
    tags_label: "可用筛查：",
  },
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 15

// ─── Helpers ─────────────────────────────────────────────────────────────────

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getPageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | "…")[] = [1]
  if (current > 3) pages.push("…")
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p)
  }
  if (current < total - 2) pages.push("…")
  pages.push(total)
  return pages
}

// ─── SpecialtyTag ─────────────────────────────────────────────────────────────

function SpecialtyTag({ label, icon: Icon, color }: { label: string; icon: React.ElementType; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-base font-semibold ${color}`}>
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </span>
  )
}

// ─── FacilityCard ─────────────────────────────────────────────────────────────

interface FacilityWithDistance extends HealthcareFacilityRow {
  distance: number | null
}

function FacilityCard({ facility, t }: { facility: FacilityWithDistance; t: typeof content.en }) {
  const navUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(facility.facility_name)}`
  const phoneClean = facility.phone?.replace(/[^\d+]/g, "") ?? ""

  return (
    <div className="group relative bg-card rounded-2xl border border-border hover:border-primary/40 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col overflow-hidden">
      {/* Sector ribbon */}
      <div className={`absolute top-0 right-0 px-3 py-1 text-sm font-bold rounded-bl-xl ${
        facility.sector === "Public"
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
          : "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
      }`}>
        {facility.sector === "Public" ? t.public_sector : t.private_sector}
      </div>

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Name + Rating */}
        <div className="pr-16">
          <h3 className="text-lg font-bold text-foreground leading-snug mb-1 group-hover:text-primary transition-colors">
            {facility.facility_name}
          </h3>
          <div className="flex items-center gap-1.5">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400 shrink-0" />
            <span className="text-base font-semibold text-amber-600 dark:text-amber-400">
              {Number(facility.ratings).toFixed(1)}
            </span>
            {facility.distance !== null && (
              <>
                <span className="text-muted-foreground mx-1">·</span>
                <MapPin className="w-4 h-4 text-primary shrink-0" />
                <span className="text-base font-semibold text-primary">
                  {facility.distance.toFixed(1)} {t.distance}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Address */}
        <div className="flex items-start gap-2.5 text-muted-foreground">
          <Building2 className="w-5 h-5 shrink-0 mt-0.5 text-muted-foreground/60" />
          <span className="text-base leading-snug">{facility.address}</span>
        </div>

        {/* Phone */}
        {facility.phone && (
          <a
            href={`tel:${phoneClean}`}
            className="flex items-center gap-2.5 text-primary hover:text-primary/80 active:opacity-60 transition-colors"
          >
            <Phone className="w-5 h-5 shrink-0" />
            <span className="text-base font-semibold">{facility.phone}</span>
          </a>
        )}

        {/* Specialty tags */}
        <div>
          <p className="text-base font-medium text-muted-foreground mb-2">{t.tags_label}</p>
          <div className="flex flex-wrap gap-2">
            {facility.is_diabetes_ready && (
              <SpecialtyTag
                label={t.specialty_diabetes}
                icon={Droplets}
                color="bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
              />
            )}
            {facility.is_bp_ready && (
              <SpecialtyTag
                label={t.specialty_bp}
                icon={Activity}
                color="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
              />
            )}
            {facility.is_cholesterol_ready && (
              <SpecialtyTag
                label={t.specialty_cholesterol}
                icon={HeartPulse}
                color="bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300"
              />
            )}
          </div>
        </div>
      </div>

      {/* Navigate button */}
      <div className="px-5 pb-5">
        <a
          href={navUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2.5 w-full py-3.5 bg-primary text-primary-foreground rounded-xl text-lg font-bold hover:opacity-90 active:scale-[0.98] transition-all"
        >
          <Navigation className="w-6 h-6 shrink-0" />
          {t.navigate}
        </a>
      </div>
    </div>
  )
}

// ─── SelectField ─────────────────────────────────────────────────────────────
function SelectField({ value, onChange, icon: Icon, label, children }: {
  value: string
  onChange: (v: string) => void
  icon: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
      <label className="flex items-center gap-1.5 text-base font-semibold text-muted-foreground px-1">
        <Icon className="w-4 h-4 shrink-0" />
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none pl-4 pr-9 py-3.5 rounded-xl border-2 border-border focus:border-primary focus:outline-none bg-background text-base cursor-pointer font-medium"
        >
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  )
}

// ─── Main Client Component ────────────────────────────────────────────────────

export function HealthcareClient({ facilities}: Props) {
  

  // ── State ──
  const [search, setSearch] = useState("")
  const [selectedState, setSelectedState] = useState("")
  const [selectedSector, setSelectedSector] = useState("")
  const [selectedSpecialty, setSelectedSpecialty] = useState("")
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationName, setLocationName] = useState<string | null>(null)
  const [showConsent, setShowConsent] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const searchRef = useRef<HTMLInputElement>(null)

  // ── Derive unique state list ──
  const stateOptions = useMemo(() => {
    const names = facilities
      .map((f) => f.state_name)
      .filter((s): s is string => Boolean(s))
    return [...new Set(names)].sort()
  }, [facilities])

  // ── Restore session ──
  useEffect(() => {
    const consent = sessionStorage.getItem("hc-consent")
    const savedLoc = sessionStorage.getItem("hc-location")
    const savedLocName = sessionStorage.getItem("hc-location-name")
    if (savedLoc) {
      try {
        setUserLocation(JSON.parse(savedLoc))
        if (savedLocName) setLocationName(savedLocName)
      } catch { /* ignore */ }
    }
    if (consent !== "granted" && consent !== "dismissed") setShowConsent(true)
  }, [])

  // ── Reverse geocode ──
  const fetchLocationName = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1&accept-language=en`
      )
      const data = await res.json()
      if (data.address) {
        const parts = [
          data.address.suburb ?? data.address.neighbourhood ?? data.address.residential ?? "",
          data.address.city ?? data.address.town ?? data.address.village ?? "",
          data.address.state ?? "",
        ].filter(Boolean)
        const name = parts.join(", ")
        if (name) {
          setLocationName(name)
          sessionStorage.setItem("hc-location-name", name)
        }
      }
    } catch { /* ignore */ }
  }, [])

  const handleAllowLocation = () => {
    setIsLocating(true)
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
        sessionStorage.setItem("hc-consent", "granted")
        sessionStorage.setItem("hc-location", JSON.stringify(loc))
        fetchLocationName(loc.lat, loc.lng)
        setShowConsent(false)
        setIsLocating(false)
      },
      () => {
        sessionStorage.setItem("hc-consent", "dismissed")
        setShowConsent(false)
        setIsLocating(false)
      }
    )
  }

  const handleDenyLocation = () => {
    sessionStorage.setItem("hc-consent", "dismissed")
    setShowConsent(false)
  }

  // ── Derived facilities ──
  const facilitiesWithDistance = useMemo(() =>
    facilities.map((f) => ({
      ...f,
      distance: userLocation
        ? haversine(userLocation.lat, userLocation.lng, f.latitude, f.longitude)
        : null,
    })),
    [facilities, userLocation]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return facilitiesWithDistance
      .filter((f) => {
        if (selectedState && f.state_name !== selectedState) return false
        if (selectedSector && f.sector !== selectedSector) return false
        if (selectedSpecialty === "diabetes" && !f.is_diabetes_ready) return false
        if (selectedSpecialty === "bp" && !f.is_bp_ready) return false
        if (selectedSpecialty === "cholesterol" && !f.is_cholesterol_ready) return false
        if (q && !f.facility_name.toLowerCase().includes(q) && !f.address.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => {
        if (a.distance !== null && b.distance !== null) return a.distance - b.distance
        if (a.distance !== null) return -1
        if (b.distance !== null) return 1
        return a.facility_name.localeCompare(b.facility_name)
      })
  }, [facilitiesWithDistance, selectedState, selectedSector, selectedSpecialty, search])

  const hasActiveFilters = Boolean(search || selectedState || selectedSector || selectedSpecialty)
  const clearFilters = () => {
    setSearch(""); setSelectedState(""); setSelectedSector(""); setSelectedSpecialty("")
  }

  // ── Pagination ──
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  useEffect(() => { setCurrentPage(1) }, [search, selectedState, selectedSector, selectedSpecialty])
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const scrollToSearch = () => {
    searchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    setTimeout(() => searchRef.current?.focus(), 400)
  }

  return (
    <PageLayout>
      {(lang) => {
        const t = content[lang]
        return (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14 space-y-8">

            {/* ── Header ── */}
            <div className="text-center space-y-3">
              <h1 className="text-2xl md:text-5xl font-extrabold tracking-tight text-balance">{t.title}</h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">{t.subtitle}</p>
            </div>

            {/* ── Consent Modal ── */}
            {showConsent && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                <div className="bg-card rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-7 sm:p-8 shadow-2xl">
                  <div className="flex items-center justify-center w-20 h-20 bg-primary/10 rounded-full mx-auto mb-5">
                    <LocateFixed className="w-10 h-10 text-primary" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">{t.consent_title}</h2>
                  <p className="text-muted-foreground text-center mb-7 text-lg leading-relaxed">{t.consent_desc}</p>
                  <div className="space-y-3">
                    <button
                      onClick={handleAllowLocation}
                      disabled={isLocating}
                      className="w-full flex items-center justify-center gap-3 bg-primary text-primary-foreground font-bold py-4 text-xl rounded-2xl hover:opacity-90 disabled:opacity-50 active:scale-[0.98] transition-all"
                    >
                      {isLocating
                        ? <div className="w-6 h-6 border-[3px] border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        : <LocateFixed className="w-6 h-6" />}
                      {t.consent_allow}
                    </button>
                    <button
                      onClick={handleDenyLocation}
                      className="w-full flex items-center justify-center gap-3 border-2 border-border font-bold py-4 text-xl rounded-2xl hover:bg-muted active:scale-[0.98] transition-all"
                    >
                      <Search className="w-6 h-6" />
                      {t.consent_deny}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Search & Filter Panel ── */}
            <div className="bg-card rounded-2xl border border-border shadow-md p-5 sm:p-6 space-y-4">

              {/* Location banner */}
              {userLocation ? (
                <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3">
                  <MapPin className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div className="flex-1">
                    <p className="font-bold text-emerald-700 dark:text-emerald-400">
                      {t.location_detected}{locationName ? ` — ${locationName}` : ""}
                    </p>
                    <p className="text-base text-emerald-600/80 dark:text-emerald-500">{t.sorted_by_distance}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                  <MapPin className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0" />
                  <p className="text-base font-medium text-amber-700 dark:text-amber-400 flex-1">{t.location_not_available}</p>
                  <button
                    onClick={() => setShowConsent(true)}
                    className="shrink-0 text-base font-bold text-amber-700 dark:text-amber-400 underline underline-offset-2 hover:opacity-80"
                  >
                    Enable
                  </button>
                </div>
              )}

              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                <input
                  ref={searchRef}
                  type="search"
                  placeholder={t.search_placeholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-12 pr-12 py-3.5 rounded-xl border-2 border-border focus:border-primary focus:outline-none bg-background text-base sm:text-lg truncate"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-muted rounded-lg transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Filter row */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <SlidersHorizontal className="w-5 h-5" />
                  <span className="text-sm font-semibold">{t.filters_label}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* State */}
                  <SelectField value={selectedState} onChange={setSelectedState} icon={MapPin} label={t.label_state}>
                    <option value="">{t.filter_state}</option>
                    {stateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                  </SelectField>

                  {/* Sector */}
                  <SelectField value={selectedSector} onChange={setSelectedSector} icon={Building2} label={t.label_sector}>
                    <option value="">{t.filter_sector}</option>
                    <option value="public">{t.sector_public}</option>
                    <option value="private">{t.sector_private}</option>
                  </SelectField>

                  {/* Specialty */}
                  <SelectField value={selectedSpecialty} onChange={setSelectedSpecialty} icon={Filter} label={t.label_specialty}>
                    <option value="">{t.filter_specialty}</option>
                    <option value="diabetes">{t.specialty_diabetes}</option>
                    <option value="bp">{t.specialty_bp}</option>
                    <option value="cholesterol">{t.specialty_cholesterol}</option>
                  </SelectField>
                </div>

                {/* Clear — full width on mobile, auto width on desktop */}
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 border-2 border-border rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors font-semibold text-base"
                  >
                    <X className="w-5 h-5" />
                    {t.clear_filters}
                  </button>
                )}
              </div>

              {/* Result count */}
              <p className="text-base text-muted-foreground font-medium">
                <span className="font-bold text-foreground text-lg">{filtered.length}</span> {t.results_count}
              </p>
            </div>

            {/* ── Grid ── */}
            {paginated.length === 0 ? (
              <div className="text-center py-20 space-y-3">
                <Stethoscope className="w-14 h-14 text-muted-foreground/30 mx-auto" />
                <p className="text-xl font-semibold text-muted-foreground">{t.no_results}</p>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="text-primary underline underline-offset-2 text-base font-medium">
                    {t.clear_filters}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {paginated.map((f) => (
                  <FacilityCard key={f.facility_id} facility={f} t={t} />
                ))}
              </div>
            )}

            {/* ── Pagination ── */}
            {filtered.length > 0 && totalPages > 1 && (
              <div className="flex flex-col items-center gap-4 pb-4">

                {/* Scroll back to search — only show when there are many results */}
                {filtered.length > ITEMS_PER_PAGE && (
                  <button
                    onClick={scrollToSearch}
                    className="bg-primary text-primary-foreground px-6 py-3 rounded-full font-bold text-base shadow-md flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all"
                  >
                    <Search className="w-5 h-5" />
                    Back to Search
                  </button>
                )}

                {/* Page nav */}
                <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-base font-bold text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    <span className="hidden sm:inline">{t.pagination_previous}</span>
                  </button>

                  {getPageNumbers(currentPage, totalPages).map((page, i) =>
                    typeof page === "number" ? (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(page)}
                        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl text-base font-semibold transition-colors ${
                          currentPage === page
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {page}
                      </button>
                    ) : (
                      <span key={i} className="px-1 text-muted-foreground text-lg">…</span>
                    )
                  )}

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-base font-bold text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="hidden sm:inline">{t.pagination_next}</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Summary */}
                <p className="text-base text-muted-foreground">
                  {t.pagination_showing}{" "}
                  <span className="font-bold text-foreground">
                    {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}
                  </span>{" "}
                  {t.pagination_of}{" "}
                  <span className="font-bold text-foreground">{filtered.length}</span>{" "}
                  {t.pagination_results}
                </p>
              </div>
            )}

            {/* ── Disclaimer ── */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 flex gap-4">
              <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-amber-800 dark:text-amber-300 text-lg mb-1">{t.disclaimer}</h3>
                <p className="text-amber-700 dark:text-amber-400 text-base leading-relaxed">{t.disclaimer_text}</p>
              </div>
            </div>
          </div>
        )
      }}
    </PageLayout>
  )
}
