// This is a server component that fetches healthcare facilities data and renders the HealthcareClient component with the fetched data as props.
import { getHealthcareFacilities } from "@/lib/queries"
import { HealthcareClient } from "./healthcare-client"

export default async function HealthcarePage() {
  const facilities = await getHealthcareFacilities()

  return (<HealthcareClient facilities={facilities}/>)
}
