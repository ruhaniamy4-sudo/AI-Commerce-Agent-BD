import { Customer } from '../models/Customer';

export async function addClient(data: {
    phone: string;
    instituteType: string;
    approximatelyStudents: number;
    facebookLink?: string;
    name?: string;
    institutionName?: string;
    assignedExecutive?: string;
    dealStatus?: string;
    adType?: string;
    schoolMedium?: string;
    signingDate?: Date;
    remarks?: string;
}) {
    // Use findOneAndUpdate with upsert to create or update the customer
    const client = await Customer.findOneAndUpdate(
        { phone: data.phone },
        {
            phone: data.phone,
            name: data.name,
            psid: data.facebookLink?.split('/').pop() || `auto-${Date.now()}`,
            metadata: {
                instituteType: data.instituteType,
                approximatelyStudents: data.approximatelyStudents,
                facebookLink: data.facebookLink,
                institutionName: data.institutionName,
                assignedExecutive: data.assignedExecutive,
                dealStatus: data.dealStatus,
                adType: data.adType,
                schoolMedium: data.schoolMedium,
                signingDate: data.signingDate,
                remarks: data.remarks,
            }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return {
        success: true,
        message: 'Customer saved successfully',
        client
    };
}
