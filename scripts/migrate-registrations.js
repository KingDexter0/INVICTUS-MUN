const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Starting migration of registrations...");
  
  // 1. Fetch all registrations and relations
  const registrations = await prisma.registration.findMany({
    include: {
      notes: true,
      paymentTransactions: true,
      certificates: true,
      awardRecords: true,
      whatsappLogs: true
    }
  });
  
  console.log(`Found ${registrations.length} registrations to migrate.`);
  
  let individualCount = 0;
  let delegationCount = 0;
  let delegateCount = 0;
  
  for (const reg of registrations) {
    if (reg.registrationType === 'delegation' || reg.totalDelegates > 0 || reg.coTeacherEmail) {
      // Migrate as a delegation registration
      delegationCount++;
      
      // Create DelegationRegistration
      const delReg = await prisma.delegationRegistration.create({
        data: {
          id: reg.id,
          publicId: reg.publicId,
          delegationName: reg.delegationName || reg.institution || "Unnamed Delegation",
          institution: reg.institution,
          coTeacherName: reg.coTeacherName || "N/A",
          coTeacherEmail: reg.coTeacherEmail || `delegation-${reg.id}@example.com`,
          coTeacherPhone: reg.coTeacherPhone || reg.phone || "N/A",
          city: reg.city,
          totalDelegates: reg.totalDelegates || 1,
          amount: reg.amount,
          paymentProofUrl: reg.paymentProofUrl,
          paymentProofPublicId: reg.paymentProofPublicId,
          paymentStatus: reg.paymentStatus,
          registrationStatus: reg.registrationStatus,
          checkedInCount: reg.checkedIn ? 1 : 0,
          createdAt: reg.createdAt,
          updatedAt: reg.updatedAt,
          registrationType: 'delegation',
          accommodationRequired: reg.accommodationRequired,
          paymentScreenshotUrl: reg.paymentScreenshotUrl,
          paymentScreenshotPublicId: reg.paymentScreenshotPublicId,
          totalAmountPaid: reg.totalAmountPaid
        }
      });
      
      // Separate delegates (from delegateNames if any, or just create one delegate representing the main contact)
      const names = reg.delegateNames ? reg.delegateNames.split(',').map(n => n.trim()).filter(Boolean) : [];
      if (names.length === 0) {
        names.push(reg.name);
      }
      
      for (let i = 0; i < names.length; i++) {
        delegateCount++;
        const delegate = await prisma.delegationDelegate.create({
          data: {
            publicId: `${reg.publicId}-d${i + 1}`,
            delegationId: delReg.id,
            name: names[i],
            email: i === 0 ? reg.email : null,
            phone: i === 0 ? reg.phone : null,
            committee1: reg.committee1,
            portfolio1: reg.portfolio1,
            allotmentStatus: reg.allotmentStatus,
            allottedCommittee: reg.allottedCommittee,
            allottedPortfolio: reg.allottedPortfolio,
            checkedIn: reg.checkedIn,
            checkedInAt: reg.checkedInAt,
            checkedInBy: reg.checkedInBy,
            certificateReleased: reg.certificateReleased,
            certificateReleasedAt: reg.certificateReleasedAt,
            certificateUrl: reg.certificateUrl,
            createdAt: reg.createdAt,
            updatedAt: reg.updatedAt
          }
        });
        
        // Migrate delegate certificates / awards if any
        for (const cert of reg.certificates) {
          await prisma.delegateCertificate.create({
            data: {
              id: cert.id,
              delegateId: delegate.id,
              title: cert.title,
              certificateNo: cert.certificateNo,
              issuedAt: cert.issuedAt,
              createdAt: cert.createdAt
            }
          });
        }
        for (const award of reg.awardRecords) {
          await prisma.delegateAward.create({
            data: {
              id: award.id,
              delegateId: delegate.id,
              title: award.title,
              category: award.category,
              committee: award.committee,
              position: award.position,
              createdAt: award.createdAt
            }
          });
        }
      }
      
      // Migrate delegation notes and transactions
      for (const note of reg.notes) {
        await prisma.delegationAdminNote.create({
          data: {
            id: note.id,
            registrationId: delReg.id,
            note: note.note,
            createdAt: note.createdAt
          }
        });
      }
      for (const tx of reg.paymentTransactions) {
        await prisma.delegationPaymentTransaction.create({
          data: {
            id: tx.id,
            registrationId: delReg.id,
            provider: tx.provider,
            orderId: tx.orderId,
            paymentId: tx.paymentId,
            signature: tx.signature,
            amount: tx.amount,
            currency: tx.currency,
            status: tx.status,
            createdAt: tx.createdAt,
            updatedAt: tx.updatedAt
          }
        });
      }
      
    } else {
      // Migrate as an individual registration
      individualCount++;
      
      await prisma.individualRegistration.create({
        data: {
          id: reg.id,
          publicId: reg.publicId,
          name: reg.name,
          email: reg.email,
          phone: reg.phone,
          age: reg.age,
          dob: reg.dob,
          gender: reg.gender,
          institution: reg.institution,
          gradeYear: reg.gradeYear,
          committee1: reg.committee1,
          portfolio1: reg.portfolio1,
          committee2: reg.committee2,
          portfolio2: reg.portfolio2,
          city: reg.city,
          isPartOfDelegation: reg.isPartOfDelegation,
          delegationName: reg.delegationName,
          refPerson: reg.refPerson,
          muns: reg.muns,
          awards: reg.awards,
          experience: reg.experience,
          utr: reg.utr,
          amount: reg.amount,
          paymentProofUrl: reg.paymentProofUrl,
          paymentProofPublicId: reg.paymentProofPublicId,
          accommodation: reg.accommodation,
          transport: reg.transport,
          arrivalCity: reg.arrivalCity,
          requirements: reg.requirements,
          paymentStatus: reg.paymentStatus,
          registrationStatus: reg.registrationStatus,
          allotmentStatus: reg.allotmentStatus,
          allottedCommittee: reg.allottedCommittee,
          allottedPortfolio: reg.allottedPortfolio,
          checkedIn: reg.checkedIn,
          checkedInAt: reg.checkedInAt,
          checkedInBy: reg.checkedInBy,
          certificateReleased: reg.certificateReleased,
          certificateReleasedAt: reg.certificateReleasedAt,
          certificateUrl: reg.certificateUrl,
          createdAt: reg.createdAt,
          updatedAt: reg.updatedAt,
          registrationType: 'individual',
          accommodationRequired: reg.accommodationRequired,
          paymentScreenshotUrl: reg.paymentScreenshotUrl,
          paymentScreenshotPublicId: reg.paymentScreenshotPublicId,
          totalAmountPaid: reg.totalAmountPaid
        }
      });
      
      // Migrate individual relations
      for (const note of reg.notes) {
        await prisma.individualAdminNote.create({
          data: {
            id: note.id,
            registrationId: reg.id,
            note: note.note,
            createdAt: note.createdAt
          }
        });
      }
      for (const tx of reg.paymentTransactions) {
        await prisma.individualPaymentTransaction.create({
          data: {
            id: tx.id,
            registrationId: reg.id,
            provider: tx.provider,
            orderId: tx.orderId,
            paymentId: tx.paymentId,
            signature: tx.signature,
            amount: tx.amount,
            currency: tx.currency,
            status: tx.status,
            createdAt: tx.createdAt,
            updatedAt: tx.updatedAt
          }
        });
      }
      for (const cert of reg.certificates) {
        await prisma.individualCertificate.create({
          data: {
            id: cert.id,
            registrationId: reg.id,
            title: cert.title,
            certificateNo: cert.certificateNo,
            issuedAt: cert.issuedAt,
            createdAt: cert.createdAt
          }
        });
      }
      for (const award of reg.awardRecords) {
        await prisma.individualAward.create({
          data: {
            id: award.id,
            registrationId: reg.id,
            title: award.title,
            category: award.category,
            committee: award.committee,
            position: award.position,
            createdAt: award.createdAt
          }
        });
      }
      for (const log of reg.whatsappLogs) {
        await prisma.individualWhatsAppLog.create({
          data: {
            id: log.id,
            registrationId: reg.id,
            phone: log.phone,
            trigger: log.trigger,
            status: log.status,
            messageId: log.messageId,
            error: log.error,
            createdAt: log.createdAt
          }
        });
      }
    }
  }
  
  console.log("Migration complete!");
  console.log(`- Migrated ${individualCount} individual registrations.`);
  console.log(`- Migrated ${delegationCount} delegation registrations.`);
  console.log(`- Created ${delegateCount} delegation delegates.`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
