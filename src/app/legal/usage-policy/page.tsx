import LegalLayout, { LegalHeading, LegalSection, LegalAccordion, LegalAccordionGroup } from "@/components/LegalLayout";

export default function UsagePolicyPage() {
  return (
    <LegalLayout>
      <LegalHeading title="Usage Policy" effectiveDate="March 17, 2026" />

      <LegalSection title="">
        <p>
          Our Usage Policy (also referred to as our &quot;Acceptable Use Policy&quot; or &quot;AUP&quot;) applies to everyone who uses Mira&apos;s products and services, including any application or partnership access, all of which we refer to as our &quot;Services.&quot; This Usage Policy is intended to help keep our service safe and promote the responsible use of our products and services.
        </p>
        <p>
          The Usage Policy is categorized according to who can use our products and in what purposes. We will update our policy as our technology and the associated risks evolve as we learn about misuse.
        </p>
        <p>
          <strong>Universal Usage Standards:</strong> Our Universal Usage Standards apply to all users and all use cases.
        </p>
        <p>
          <strong>High-Risk Use Case Requirements:</strong> Our High-Risk Use Case Requirements apply to specific consumer-facing use cases that pose an elevated risk of harm.
        </p>
        <p>
          Mira&apos;s safeguards team will implement detection and monitoring to enforce our Usage Policy and may review content flagged for potential violations.
        </p>
      </LegalSection>

      <LegalAccordionGroup title="Universal Usage Standards">
        <LegalAccordion title="Do Not Violate Applicable Laws or Engage in Illegal Activity">
          <p>
            You may not use Mira to facilitate, promote, or engage in any activity that violates applicable laws or regulations in any jurisdiction. This includes but is not limited to fraud, money laundering, trafficking, and other criminal activities.
          </p>
        </LegalAccordion>

        <LegalAccordion title="Do Not Compromise Critical Infrastructure">
          <p>
            You may not use Mira to attack, disrupt, or gain unauthorized access to critical infrastructure systems, including power grids, water systems, transportation networks, financial systems, or government services.
          </p>
        </LegalAccordion>

        <LegalAccordion title="Do Not Compromise Computer or Network Systems">
          <p>
            You may not use Mira to generate malware, viruses, exploit code, or to assist in compromising the security of computer systems and networks. This includes generating code designed to bypass security measures or gain unauthorized access to systems.
          </p>
        </LegalAccordion>

        <LegalAccordion title="Do Not Develop or Design Weapons">
          <p>
            You may not use Mira to design, develop, or produce weapons of any kind, including biological, chemical, nuclear, or radiological weapons, or to provide instructions for creating such weapons.
          </p>
        </LegalAccordion>

        <LegalAccordion title="Do Not Incite Violence or Hateful Behavior">
          <p>
            You may not use Mira to generate content that promotes violence, terrorism, hate speech, or discrimination based on race, ethnicity, religion, gender, sexual orientation, disability, or other protected characteristics.
          </p>
        </LegalAccordion>

        <LegalAccordion title="Do Not Compromise Privacy or Identity Rights">
          <p>
            You may not use Mira to collect, process, or disclose personal information without proper authorization. This includes creating deepfakes, impersonating individuals, or conducting surveillance without consent.
          </p>
        </LegalAccordion>

        <LegalAccordion title="Do Not Compromise Children's Safety">
          <p>
            You may not use Mira to create, distribute, or facilitate any content that exploits or harms minors. This includes but is not limited to child sexual abuse material (CSAM), grooming content, or any material that sexualizes minors.
          </p>
        </LegalAccordion>

        <LegalAccordion title="Do Not Create Psychologically or Emotionally Harmful Content">
          <p>
            You may not use Mira to create content specifically designed to cause psychological harm, including targeted harassment, manipulation, or content that exploits vulnerable individuals.
          </p>
        </LegalAccordion>

        <LegalAccordion title="Do Not Create or Spread Misinformation">
          <p>
            You may not use Mira to generate false or misleading information with the intent to deceive. This includes creating fake news articles, fabricating scientific claims, or generating deceptive content designed to manipulate public opinion.
          </p>
        </LegalAccordion>

        <LegalAccordion title="Do Not Undermine Democratic Processes or Engage in Targeted Campaign Activities">
          <p>
            You may not use Mira for targeted political campaign activities, voter suppression, or generating misleading political content. AI-generated political content must be clearly labeled as such.
          </p>
        </LegalAccordion>

        <LegalAccordion title="Do Not Use for Criminal Justice, Censorship, Surveillance, or Prohibited Law Enforcement Purposes">
          <p>
            You may not use Mira for mass surveillance, predictive policing, social scoring, or censorship activities that violate fundamental human rights. Law enforcement use requires explicit authorization and appropriate oversight.
          </p>
        </LegalAccordion>

        <LegalAccordion title="Do Not Engage in Fraudulent, Abusive, or Predatory Practices">
          <p>
            You may not use Mira for scams, phishing, social engineering, or other fraudulent activities. You may not misrepresent AI-generated content as human-created in contexts where such disclosure is required.
          </p>
        </LegalAccordion>

        <LegalAccordion title="Do Not Abuse our Platform">
          <p>
            You may not attempt to circumvent usage limits, reverse-engineer our models, extract training data, or use automated means to access the Service in violation of our terms. You may not resell access to the Service without authorization.
          </p>
        </LegalAccordion>

        <LegalAccordion title="Do Not Generate Sexually Explicit Content">
          <p>
            You may not use Mira to generate sexually explicit or pornographic content. This applies to text, code, and any other outputs from the Service.
          </p>
        </LegalAccordion>
      </LegalAccordionGroup>

      <LegalSection title="Enforcement">
        <p>
          We actively monitor for violations of this policy. Our safeguards team reviews flagged content and may take the following actions:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Issue a warning for first-time or minor violations</li>
          <li>Temporarily restrict access to certain features</li>
          <li>Suspend or permanently terminate your account</li>
          <li>Report illegal activity to relevant authorities</li>
        </ul>
        <p>
          If you believe your account was restricted in error, you may appeal by contacting support@mira.ai.
        </p>
      </LegalSection>

      <LegalSection title="Reporting Violations">
        <p>
          If you encounter content or behavior that violates this policy, please report it to abuse@mira.ai. We review all reports and take appropriate action.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
