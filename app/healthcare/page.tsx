import { PageLayout } from "@/components/page-layout"
import { getHealthcareFacilities } from "@/lib/queries"
import { HealthcareClient } from "./healthcare-client"

export default async function HealthcarePage() {
  const facilities = await getHealthcareFacilities()

  return (<HealthcareClient facilities={facilities}/>)
}
