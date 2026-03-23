import type { Metadata } from "next";
import LegalLayout, { LegalHeading, LegalSection, LegalList } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
  description: "Как Мира AI обрабатывает и защищает ваши персональные данные. Соответствие 152-ФЗ.",
  alternates: { canonical: "https://vmira.ai/legal/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalLayout>
      <LegalHeading title="Privacy Policy" effectiveDate="March 17, 2026" />

      <LegalSection title="1. Introduction">
        <p>
          This Privacy Policy describes how Mira AI (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses, and protects your personal information when you use our Service.
        </p>
        <p>
          We are committed to protecting your privacy and handling your data transparently. This policy complies with applicable data protection laws, including Federal Law No. 152-FZ on Personal Data.
        </p>
      </LegalSection>

      <LegalSection title="2. Information We Collect">
        <p><strong>Account information:</strong> When you create an account, we collect your name, email address, and password.</p>
        <p><strong>Usage data:</strong> We collect information about how you interact with the Service, including features used, timestamps, and device information.</p>
        <p><strong>Conversation data:</strong> We process the messages you send to and receive from the AI assistant to provide the Service.</p>
        <p><strong>Payment information:</strong> If you subscribe to a paid plan, payment processing is handled by third-party providers. We do not store your full payment card details.</p>
      </LegalSection>

      <LegalSection title="3. How We Use Your Information">
        <p>We use your information for the following purposes:</p>
        <LegalList items={[
          "To provide, maintain, and improve the Service",
          "To process your transactions and manage your subscription",
          "To communicate with you about updates, security alerts, and support",
          "To detect, prevent, and address technical issues and abuse",
          "To comply with legal obligations",
        ]} />
      </LegalSection>

      <LegalSection title="4. Conversation Data">
        <p>
          Your conversations with Mira are processed to generate responses. By default, we do not use your conversations to train or improve our AI models.
        </p>
        <p>
          You can opt in to sharing anonymized conversation data to help improve the Service through your Privacy settings. This is entirely optional and can be changed at any time.
        </p>
        <p>
          Chat history is stored on your account for your convenience. You can delete individual conversations or all chat history at any time.
        </p>
      </LegalSection>

      <LegalSection title="5. Data Storage and Security">
        <p>
          Your data is stored on servers located in the Russian Federation, in compliance with Federal Law No. 152-FZ. We implement industry-standard security measures to protect your data, including encryption in transit and at rest.
        </p>
        <p>
          While we take reasonable precautions, no method of transmission or storage is 100% secure. We cannot guarantee absolute security of your data.
        </p>
      </LegalSection>

      <LegalSection title="6. Data Sharing">
        <p>We do not sell your personal information. We may share your data only in the following circumstances:</p>
        <LegalList items={[
          "With service providers who assist us in operating the Service (e.g., hosting, payment processing)",
          "When required by law, regulation, or legal process",
          "To protect the rights, safety, or property of Mira AI, our users, or the public",
          "In connection with a merger, acquisition, or sale of assets (with prior notice)",
        ]} />
      </LegalSection>

      <LegalSection title="7. Your Rights">
        <p>You have the right to:</p>
        <LegalList items={[
          "Access, correct, or delete your personal information",
          "Export your data in a portable format",
          "Withdraw consent for optional data processing",
          "Delete your account and all associated data",
          "Object to processing of your personal data",
        ]} />
        <p>
          To exercise these rights, visit your account settings or contact us at privacy@mira.ai.
        </p>
      </LegalSection>

      <LegalSection title="8. Cookies and Analytics">
        <p>
          We use essential cookies to maintain your session and preferences. We may use analytics tools to understand how the Service is used. You can manage cookie preferences through your browser settings.
        </p>
      </LegalSection>

      <LegalSection title="9. Children&apos;s Privacy">
        <p>
          The Service is not intended for users under the age of 14. We do not knowingly collect personal information from children. If we become aware of such collection, we will take steps to delete the data promptly.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. We will notify you of material changes through the Service or by email. Continued use after changes constitutes acceptance.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact">
        <p>
          For privacy-related inquiries, contact our Data Protection Officer at privacy@mira.ai.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
